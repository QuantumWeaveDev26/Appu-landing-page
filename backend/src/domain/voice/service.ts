import { Readable } from 'node:stream';

export interface ElevenLabsStreamServiceOptions {
  apiKey: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}

export class ElevenLabsStreamService {
  private apiKey: string;
  private voiceId: string;
  private modelId: string;
  private stability: number;
  private similarityBoost: number;
  private speed: number;

  constructor(options: ElevenLabsStreamServiceOptions) {
    if (!options.apiKey || !options.apiKey.trim()) {
      throw new Error('ElevenLabsStreamService requires a valid server-side apiKey');
    }
    this.apiKey = options.apiKey.trim();
    this.voiceId = options.voiceId || '2vNb4zVImeugpHCemE1R';
    this.modelId = options.modelId || 'eleven_v3';
    this.stability = options.stability ?? 0.75;
    this.similarityBoost = options.similarityBoost ?? 0.8;
    this.speed = options.speed ?? 0.82;
  }

  /**
   * Initiates HTTP chunked streaming from ElevenLabs API.
   * Returns a Node.js Readable stream of audio/mpeg bytes.
   */
  public async getAudioStream(text: string): Promise<{
    stream: Readable;
    contentType: string;
    modelId: string;
  }> {
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'xi-api-key': this.apiKey
      },
      body: JSON.stringify({
        text,
        model_id: this.modelId,
        voice_settings: {
          stability: this.stability,
          similarity_boost: this.similarityBoost,
          speed: this.speed
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => 'Unknown upstream error');
      throw new Error(`ElevenLabs streaming error (${response.status}): ${errBody}`);
    }

    if (!response.body) {
      throw new Error('ElevenLabs streaming returned empty body');
    }

    // Convert Web ReadableStream to Node.js Readable
    const nodeStream = Readable.fromWeb(response.body as any);

    return {
      stream: nodeStream,
      contentType: 'audio/mpeg',
      modelId: this.modelId
    };
  }
}
