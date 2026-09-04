import crypto from 'node:crypto';
import type { Queryable } from '../../db/types.js';
import type {
  ConversationHistoryEntry,
  ConversationMessage,
  ConversationRole,
  ConversationSession,
  ConversationSummary
} from './types.js';

function mapSessionRow(row: {
  id: string;
  household_id: string;
  child_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
}): ConversationSession {
  return {
    id: row.id,
    householdId: row.household_id,
    childId: row.child_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at
  };
}

export class ConversationRepository {
  static async create(
    db: Queryable,
    householdId: string,
    childId: string,
    title: string
  ): Promise<ConversationSession> {
    const id = crypto.randomUUID();
    const res = await db.query<{
      id: string;
      household_id: string;
      child_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date;
    }>(
      `INSERT INTO conversation_sessions (id, household_id, child_id, title)
       VALUES ($1, $2, $3, $4)
       RETURNING id, household_id, child_id, title, created_at, updated_at, expires_at`,
      [id, householdId, childId, title]
    );
    return mapSessionRow(res.rows[0]);
  }

  static async getOwned(
    db: Queryable,
    householdId: string,
    childId: string,
    conversationId: string
  ): Promise<ConversationSession | null> {
    const res = await db.query<{
      id: string;
      household_id: string;
      child_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date;
    }>(
      `SELECT id, household_id, child_id, title, created_at, updated_at, expires_at
       FROM conversation_sessions
       WHERE id = $1 AND household_id = $2 AND child_id = $3 AND expires_at > NOW()`,
      [conversationId, householdId, childId]
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapSessionRow(res.rows[0]);
  }

  static async getLatestOwned(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<ConversationSession | null> {
    const res = await db.query<{
      id: string;
      household_id: string;
      child_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date;
    }>(
      `SELECT id, household_id, child_id, title, created_at, updated_at, expires_at
       FROM conversation_sessions
       WHERE household_id = $1 AND child_id = $2 AND expires_at > NOW()
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`,
      [householdId, childId]
    );
    if (res.rows.length === 0) {
      return null;
    }
    return mapSessionRow(res.rows[0]);
  }

  static async listRecent(
    db: Queryable,
    householdId: string,
    childId: string,
    limit: number = 30
  ): Promise<ConversationSummary[]> {
    const boundedLimit = Math.max(1, limit);
    const res = await db.query<{
      id: string;
      household_id: string;
      child_id: string;
      title: string;
      created_at: Date;
      updated_at: Date;
      expires_at: Date;
    }>(
      `SELECT s.id, s.household_id, s.child_id, s.title, s.created_at, s.updated_at, s.expires_at
       FROM conversation_sessions s
       WHERE s.household_id = $1 AND s.child_id = $2 AND s.expires_at > NOW()
       ORDER BY s.updated_at DESC, s.created_at DESC
       LIMIT $3`,
      [householdId, childId, boundedLimit]
    );

    const summaries: ConversationSummary[] = [];
    for (const row of res.rows) {
      const msgRes = await db.query<{ text: string }>(
        `SELECT text FROM conversation_messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [row.id]
      );

      summaries.push({
        id: row.id,
        householdId: row.household_id,
        childId: row.child_id,
        title: row.title,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at,
        lastMessagePreview: msgRes.rows[0]?.text ?? null
      });
    }

    return summaries;
  }

  static async listMessages(
    db: Queryable,
    householdId: string,
    childId: string,
    conversationId: string,
    limit: number = 100
  ): Promise<ConversationMessage[]> {
    const boundedLimit = Math.max(1, limit);
    const res = await db.query<{
      id: string;
      conversation_id: string;
      request_id: string | null;
      role: ConversationRole;
      text: string;
      has_image_attachment: boolean;
      created_at: Date;
    }>(
      `SELECT id, conversation_id, request_id, role, text, has_image_attachment, created_at
       FROM (
         SELECT m.id, m.conversation_id, m.request_id, m.role, m.text, m.has_image_attachment, m.created_at
         FROM conversation_messages m
         JOIN conversation_sessions s ON s.id = m.conversation_id
         WHERE m.conversation_id = $1
           AND s.household_id = $2
           AND s.child_id = $3
           AND s.expires_at > NOW()
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $4
       ) sub
       ORDER BY sub.created_at ASC, sub.id ASC`,
      [conversationId, householdId, childId, boundedLimit]
    );

    return res.rows.map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      requestId: row.request_id,
      role: row.role,
      text: row.text,
      hasImageAttachment: Boolean(row.has_image_attachment),
      createdAt: row.created_at
    }));
  }

  static async listContext(
    db: Queryable,
    householdId: string,
    childId: string,
    conversationId: string,
    turnLimit: number = 8
  ): Promise<ConversationHistoryEntry[]> {
    const maxMessages = Math.max(1, turnLimit) * 2;
    const res = await db.query<{
      role: ConversationRole;
      text: string;
    }>(
      `SELECT role, text
       FROM (
         SELECT m.id, m.role, m.text, m.created_at
         FROM conversation_messages m
         JOIN conversation_sessions s ON s.id = m.conversation_id
         WHERE m.conversation_id = $1
           AND s.household_id = $2
           AND s.child_id = $3
           AND s.expires_at > NOW()
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT $4
       ) sub
       ORDER BY sub.created_at ASC, sub.id ASC`,
      [conversationId, householdId, childId, maxMessages]
    );

    return res.rows.map((row) => ({
      role: row.role,
      text: row.text
    }));
  }

  static async deleteOwned(
    db: Queryable,
    householdId: string,
    childId: string,
    conversationId: string
  ): Promise<boolean> {
    const res = await db.query(
      `DELETE FROM conversation_sessions
       WHERE id = $1 AND household_id = $2 AND child_id = $3`,
      [conversationId, householdId, childId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async deleteAllOwned(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<number> {
    const res = await db.query(
      `DELETE FROM conversation_sessions
       WHERE household_id = $1 AND child_id = $2`,
      [householdId, childId]
    );
    return res.rowCount ?? 0;
  }

  static async deleteExpired(
    db: Queryable,
    batchSize: number = 500
  ): Promise<number> {
    const toDelete = await db.query<{ id: string }>(
      `SELECT id FROM conversation_sessions
       WHERE expires_at <= NOW()
       LIMIT $1`,
      [batchSize]
    );

    if (toDelete.rows.length === 0) {
      return 0;
    }

    let count = 0;
    for (const row of toDelete.rows) {
      const delRes = await db.query(
        `DELETE FROM conversation_sessions WHERE id = $1`,
        [row.id]
      );
      count += delRes.rowCount ?? 0;
    }
    return count;
  }
}
