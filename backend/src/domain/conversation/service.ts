import crypto from 'node:crypto';
import type { TransactionalQueryable } from '../../db/types.js';
import { ConversationRepository } from './repository.js';
import type { AppendSuccessfulExchangeInput, ConversationSession } from './types.js';

export class ConversationService {
  static normalizeTitle(firstMessage?: string, hasImageAttachment?: boolean): string {
    const cleaned = (firstMessage || '').trim().replace(/\s+/g, ' ');
    if (cleaned.length > 0) {
      return cleaned.slice(0, 120);
    }
    if (hasImageAttachment) {
      return 'Homework photo';
    }
    return 'New conversation';
  }

  static async createAndPrune(
    db: TransactionalQueryable,
    householdId: string,
    childId: string,
    firstMessage?: string
  ): Promise<ConversationSession> {
    return db.transaction(async (txDb) => {
      const title = ConversationService.normalizeTitle(firstMessage);
      const session = await ConversationRepository.create(txDb, householdId, childId, title);

      // Prune conversations beyond rank 30 for this child
      const excessRows = await txDb.query<{ id: string }>(
        `SELECT id FROM conversation_sessions
         WHERE household_id = $1 AND child_id = $2
         ORDER BY updated_at DESC, created_at DESC
         OFFSET 30`,
        [householdId, childId]
      );

      if (excessRows.rows.length > 0) {
        for (const excess of excessRows.rows) {
          await ConversationRepository.deleteOwned(txDb, householdId, childId, excess.id);
        }
      }

      return session;
    });
  }

  static async resolveOwnedOrLatest(
    db: TransactionalQueryable,
    householdId: string,
    childId: string,
    conversationId?: string
  ): Promise<ConversationSession> {
    if (conversationId) {
      const session = await ConversationRepository.getOwned(db, householdId, childId, conversationId);
      if (!session) {
        throw new Error('Conversation not found');
      }
      return session;
    }

    const latest = await ConversationRepository.getLatestOwned(db, householdId, childId);
    if (latest) {
      return latest;
    }

    return ConversationService.createAndPrune(db, householdId, childId, undefined);
  }

  static async appendSuccessfulExchange(
    db: TransactionalQueryable,
    input: AppendSuccessfulExchangeInput
  ): Promise<void> {
    await db.transaction(async (txDb) => {
      const sessionRes = await txDb.query<{ id: string; title: string }>(
        `SELECT id, title FROM conversation_sessions
         WHERE id = $1 AND household_id = $2 AND child_id = $3 AND expires_at > NOW()`,
        [input.conversationId, input.householdId, input.childId]
      );

      if (sessionRes.rows.length === 0) {
        throw new Error('Conversation not found or expired');
      }

      const session = sessionRes.rows[0];

      const userMsgId = crypto.randomUUID();
      await txDb.query(
        `INSERT INTO conversation_messages (
           id, conversation_id, request_id, role, text, has_image_attachment, created_at
         ) VALUES ($1, $2, $3, 'user', $4, $5, NOW())
         ON CONFLICT (request_id, role) DO NOTHING`,
        [userMsgId, input.conversationId, input.requestId, input.userText, Boolean(input.hasImageAttachment)]
      );

      const assistantMsgId = crypto.randomUUID();
      await txDb.query(
        `INSERT INTO conversation_messages (
           id, conversation_id, request_id, role, text, has_image_attachment, created_at
         ) VALUES ($1, $2, $3, 'assistant', $4, FALSE, NOW())
         ON CONFLICT (request_id, role) DO NOTHING`,
        [assistantMsgId, input.conversationId, input.requestId, input.assistantText]
      );

      if (session.title === 'New conversation') {
        const newTitle = ConversationService.normalizeTitle(input.userText, input.hasImageAttachment);
        await txDb.query(
          `UPDATE conversation_sessions
           SET title = $1,
               updated_at = NOW(),
               expires_at = (NOW() + INTERVAL '90 days')
           WHERE id = $2 AND household_id = $3 AND child_id = $4`,
          [newTitle, input.conversationId, input.householdId, input.childId]
        );
      } else {
        await txDb.query(
          `UPDATE conversation_sessions
           SET updated_at = NOW(),
               expires_at = (NOW() + INTERVAL '90 days')
           WHERE id = $1 AND household_id = $2 AND child_id = $3`,
          [input.conversationId, input.householdId, input.childId]
        );
      }
    });
  }
}
