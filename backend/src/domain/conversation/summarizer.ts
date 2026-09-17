import type { Queryable } from '../../db/types.js';
import { ConversationRepository } from './repository.js';
import type {
  ConversationHistoryEntry,
  ConversationMessage,
  CompactedSessionContext
} from './types.js';

export interface CompactSessionMemoryOptions {
  /** Maximum number of verbatim recent messages to include in the tail (default: 20, ~10 turns). */
  tailLimit?: number;
  /** OpenAI API key. Falls back to process.env.OPENAI_API_KEY. */
  openaiApiKey?: string;
  /** Maximum duration before aborting the summarization LLM call (default: 5000ms). */
  timeoutMs?: number;
  /** Custom fetch function for dependency injection / testing. Defaults to globalThis.fetch. */
  fetchFn?: typeof fetch;
  /** Logger instance for diagnostics. */
  logger?: {
    warn: (objOrMsg: any, msg?: string) => void;
    info?: (objOrMsg: any, msg?: string) => void;
    error?: (objOrMsg: any, msg?: string) => void;
  };
}

export const ROLLING_SUMMARY_SYSTEM_PROMPT =
  `You are a high-fidelity conversation memory compressor for an AI tutor (Appu). ` +
  `Your job is to maintain a progressive, rolling summary of an ongoing tutoring conversation between a learner and Appu.\n\n` +
  `CRITICAL REQUIREMENTS:\n` +
  `1. Retain ALL facts, learner preferences, topics, concepts explained, formulas, specific problem steps solved, misconceptions identified, and open/unresolved questions.\n` +
  `2. Merge the previous summary (if any) with the new conversation turns into a coherent, concise, progressive summary.\n` +
  `3. Keep it factual and information-dense. Use concise bullet points or short paragraphs.\n` +
  `4. Plain text only. Never output markdown formatting like bolding (**), asterisks (*), hashtags (#), or code blocks, as this summary is injected directly into voice and chat prompts.\n` +
  `5. Do NOT invent or assume any facts not present in the conversation.`;

function formatTurns(messages: ConversationMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'Learner' : 'Appu'}: ${m.text}`)
    .join('\n');
}

export function sanitizeSummary(text: string): string {
  return text
    .replace(/[*_~`#]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Retrieve recent conversation history alongside a progressive rolling summary of earlier turns.
 * If total messages exceed tailLimit (default 20), earlier unsummarized turns are compacted using gpt-4.1-mini.
 *
 * Guaranteed fail-safe: any DB or LLM failure returns a safe recent tail and existing summary (or ''),
 * never throwing or interrupting the live chat request.
 */
export async function compactSessionMemory(
  db: Queryable,
  householdId: string,
  childId: string,
  conversationId: string,
  options?: CompactSessionMemoryOptions
): Promise<CompactedSessionContext> {
  const tailLimit = Math.max(2, options?.tailLimit ?? 20);
  const logger = options?.logger;
  const fetchClient = options?.fetchFn ?? globalThis.fetch;

  try {
    // 1. Fetch session and all chronological messages
    const session = await ConversationRepository.getOwned(db, householdId, childId, conversationId);
    if (!session) {
      return { conversationHistory: [], sessionSummary: '' };
    }

    const messages = await ConversationRepository.listAllMessages(db, householdId, childId, conversationId);
    if (messages.length === 0) {
      return { conversationHistory: [], sessionSummary: session.rollingSummary || '' };
    }

    // 2. If all messages fit within tail, no compaction needed
    if (messages.length <= tailLimit) {
      return {
        conversationHistory: messages.map((m) => ({ role: m.role, text: m.text })),
        sessionSummary: session.rollingSummary || ''
      };
    }

    // 3. Partition messages into older chunk and recent tail
    const recentTail = messages.slice(-tailLimit);
    const olderMessages = messages.slice(0, -tailLimit);
    const lastOlderMessage = olderMessages[olderMessages.length - 1];

    // Check if older messages have already been summarized up to lastOlderMessage
    if (session.summarizedUpToMessageId) {
      const lastSummarizedIdx = olderMessages.findIndex((m) => m.id === session.summarizedUpToMessageId);
      if (lastSummarizedIdx === olderMessages.length - 1) {
        // Current rolling summary is already fully up to date with the older chunk
        return {
          conversationHistory: recentTail.map((m) => ({ role: m.role, text: m.text })),
          sessionSummary: session.rollingSummary || ''
        };
      }
    }

    // Identify which older messages have not yet been compacted
    let unsummarizedOlder: ConversationMessage[];
    if (session.summarizedUpToMessageId) {
      const idx = olderMessages.findIndex((m) => m.id === session.summarizedUpToMessageId);
      if (idx >= 0) {
        unsummarizedOlder = olderMessages.slice(idx + 1);
      } else {
        unsummarizedOlder = olderMessages;
      }
    } else {
      unsummarizedOlder = olderMessages;
    }

    if (unsummarizedOlder.length === 0) {
      return {
        conversationHistory: recentTail.map((m) => ({ role: m.role, text: m.text })),
        sessionSummary: session.rollingSummary || ''
      };
    }

    // 4. Summarize unsummarized older turns via gpt-4.1-mini
    const apiKey = options?.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      logger?.warn?.(
        { conversationId },
        'OPENAI_API_KEY missing; skipping compaction and returning existing rolling summary'
      );
      return {
        conversationHistory: recentTail.map((m) => ({ role: m.role, text: m.text })),
        sessionSummary: session.rollingSummary || ''
      };
    }

    const userPrompt =
      `Existing session summary:\n${session.rollingSummary || 'None (this is the start of the session).'}\n\n` +
      `New conversation turns to incorporate:\n${formatTurns(unsummarizedOlder)}\n\n` +
      `Updated comprehensive rolling session summary (plain text, no markdown):`;

    const timeoutMs = options?.timeoutMs ?? 5000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchClient('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: ROLLING_SUMMARY_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 600
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        logger?.warn?.(
          { status: response.status, errBody, conversationId },
          'OpenAI compaction call failed; using existing rolling summary'
        );
        return {
          conversationHistory: recentTail.map((m) => ({ role: m.role, text: m.text })),
          sessionSummary: session.rollingSummary || ''
        };
      }

      const data = (await response.json()) as any;
      const rawContent = data?.choices?.[0]?.message?.content;
      if (!rawContent || typeof rawContent !== 'string') {
        logger?.warn?.({ conversationId }, 'OpenAI returned empty summary content');
        return {
          conversationHistory: recentTail.map((m) => ({ role: m.role, text: m.text })),
          sessionSummary: session.rollingSummary || ''
        };
      }

      const updatedSummary = sanitizeSummary(rawContent);

      // 5. Persist updated summary and checkpoint to database
      await ConversationRepository.updateRollingSummary(
        db,
        householdId,
        childId,
        conversationId,
        updatedSummary,
        lastOlderMessage.id
      );

      return {
        conversationHistory: recentTail.map((m) => ({ role: m.role, text: m.text })),
        sessionSummary: updatedSummary
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  } catch (err) {
    // Fail-safe: Compaction failure must NEVER break the conversation request path
    logger?.warn?.({ err, conversationId }, 'Session memory compaction error; falling back to recent tail');
    try {
      const fallbackTail = await ConversationRepository.listContext(db, householdId, childId, conversationId, 10);
      return {
        conversationHistory: fallbackTail,
        sessionSummary: ''
      };
    } catch {
      return {
        conversationHistory: [],
        sessionSummary: ''
      };
    }
  }
}
