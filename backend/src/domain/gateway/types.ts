import type { MentorContext } from '../personalisation/types.js';

export interface N8nMessageEnvelope {
  requestId: string;
  action: 'sendMessage';
  channel: 'website';
  sessionId: string;
  chatInput: string;
  message: string;
  language: string;
  childId?: string;
  conversationId?: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; text: string }>;
  includeAudio?: boolean;
  imageBase64?: string;
  imageMimeType?: string;
  mentorContext: MentorContext;
  parentPhone?: string | null;
  whatsappConsent?: boolean;
}

export interface N8nMessageResponse {
  text: string;
  audioSource: string | null;
  audioDurationMs?: number | null;
  raw?: unknown;
}

export interface N8nClient {
  sendMessage(envelope: N8nMessageEnvelope): Promise<N8nMessageResponse>;
}
