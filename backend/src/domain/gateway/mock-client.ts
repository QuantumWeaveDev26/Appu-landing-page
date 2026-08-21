import type { N8nClient, N8nMessageEnvelope, N8nMessageResponse } from './types.js';

export class MockN8nClient implements N8nClient {
  public lastEnvelope: N8nMessageEnvelope | null = null;
  public callCount = 0;
  public nextResponse: N8nMessageResponse = {
    text: 'Hello from mock Appu!',
    audioSource: 'data:audio/mpeg;base64,mockAudioData'
  };
  public nextError: Error | null = null;

  public async sendMessage(envelope: N8nMessageEnvelope): Promise<N8nMessageResponse> {
    this.callCount++;
    this.lastEnvelope = envelope;

    if (this.nextError) {
      throw this.nextError;
    }

    return this.nextResponse;
  }
}
