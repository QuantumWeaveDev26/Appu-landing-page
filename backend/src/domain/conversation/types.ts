export type ConversationRole = 'user' | 'assistant';

export interface ConversationSession {
  id: string;
  householdId: string;
  childId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ConversationSummary {
  id: string;
  householdId: string;
  childId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastMessagePreview?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  requestId: string | null;
  role: ConversationRole;
  text: string;
  hasImageAttachment: boolean;
  createdAt: Date;
}

export interface ConversationHistoryEntry {
  role: ConversationRole;
  text: string;
}

export interface AppendSuccessfulExchangeInput {
  householdId: string;
  childId: string;
  conversationId: string;
  requestId: string;
  userText: string;
  assistantText: string;
  hasImageAttachment: boolean;
}
