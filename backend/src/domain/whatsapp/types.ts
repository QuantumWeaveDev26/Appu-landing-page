import type { AuthenticatedMentorContext } from '../personalisation/types.js';

export interface WhatsAppConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface WhatsAppContextResult {
  recognized: boolean;
  householdId?: string;
  childId?: string;
  mentorContext?: AuthenticatedMentorContext;
  conversationHistory?: WhatsAppConversationTurn[];
  formattedTranscript?: string;
  linkNudge?: string;
}
