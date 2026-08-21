import type { ChildAIContext } from '../personalisation/types.js';

export interface N8nMessageEnvelope {
  action: 'sendMessage';
  channel: 'website';
  sessionId: string;
  chatInput: string;
  message: string;
  language: string;
  childId: string;
  context: ChildAIContext;
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
