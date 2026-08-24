import { BadGatewayError, ServiceUnavailableError } from '../../errors/index.js';
import type { N8nClient, N8nMessageEnvelope, N8nMessageResponse } from './types.js';
import { parseAudioDuration } from './audio-duration-parser.js';
import { createAppuHmacSignature } from './hmac.js';

export interface DefaultN8nClientOptions {
  webhookUrl: string;
  timeoutMs?: number;
  requestSigningSecret?: string;
  now?: () => number;
}

function toAudioSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const audio = value.trim();
  if (!audio) return null;

  if (/^(data:audio\/|https?:\/\/|blob:)/i.test(audio)) {
    return audio;
  }

  return `data:audio/mpeg;base64,${audio}`;
}

export class DefaultN8nClient implements N8nClient {
  private readonly webhookUrl: string;
  private readonly timeoutMs: number;
  private readonly requestSigningSecret: string | null;
  private readonly now: () => number;

  constructor(options: DefaultN8nClientOptions) {
    if (!options.webhookUrl || typeof options.webhookUrl !== 'string') {
      throw new Error('DefaultN8nClient requires a valid webhookUrl');
    }
    this.webhookUrl = options.webhookUrl;
    this.timeoutMs = options.timeoutMs ?? 20000;
    this.requestSigningSecret = options.requestSigningSecret?.trim() || null;
    this.now = options.now ?? Date.now;
  }

  public async sendMessage(envelope: N8nMessageEnvelope): Promise<N8nMessageResponse> {
    let response: Response;
    const rawBody = JSON.stringify(envelope);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.requestSigningSecret) {
      const timestamp = String(Math.floor(this.now() / 1000));
      headers['X-APPU-Timestamp'] = timestamp;
      headers['X-APPU-Signature'] = createAppuHmacSignature(
        rawBody,
        timestamp,
        this.requestSigningSecret
      );
    }

    try {
      response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: rawBody,
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error: any) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new ServiceUnavailableError(
          'AI mentor service timed out waiting for response. Please try again.'
        );
      }
      throw new ServiceUnavailableError(
        'AI mentor request outcome is unknown. Please retry with the same request ID.'
      );
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new ServiceUnavailableError(
          'AI mentor request outcome is unknown. Please retry with the same request ID.'
        );
      }
      throw new BadGatewayError(
        `AI mentor service returned an error status (${response.status}).`
      );
    }

    const rawText = await response.text();
    let parsed: any = null;

    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Raw plain text response
      return {
        text: rawText.replace(/\\n/g, '\n').trim(),
        audioSource: null,
        audioDurationMs: null
      };
    }

    const payload = Array.isArray(parsed) ? parsed[0] : parsed;
    const data = payload && typeof payload === 'object' ? payload : {};

    const rawMsg = data.output ?? data.text ?? data.response ?? data.message ?? '';
    const text = (typeof rawMsg === 'string' ? rawMsg.replace(/\\n/g, '\n') : String(rawMsg ?? '')).trim();

    const rawAudio =
      data.audio_base64 ??
      data.audioBase64 ??
      data.audioUrl ??
      data.audio_url ??
      data.audio ??
      data.voiceUrl;

    const audioSource = toAudioSource(rawAudio);
    const audioDurationMs = audioSource
      ? parseAudioDuration(rawAudio, data.duration_ms ?? data.audio_duration_ms ?? data.durationMs)
      : null;

    return {
      text: text || 'Namaskara! I am listening.',
      audioSource,
      audioDurationMs,
      raw: parsed
    };
  }
}
