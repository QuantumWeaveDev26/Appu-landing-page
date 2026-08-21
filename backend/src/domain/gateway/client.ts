import { BadGatewayError, ServiceUnavailableError } from '../../errors/index.js';
import type { N8nClient, N8nMessageEnvelope, N8nMessageResponse } from './types.js';

export interface DefaultN8nClientOptions {
  webhookUrl: string;
  timeoutMs?: number;
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

  constructor(options: DefaultN8nClientOptions) {
    if (!options.webhookUrl || typeof options.webhookUrl !== 'string') {
      throw new Error('DefaultN8nClient requires a valid webhookUrl');
    }
    this.webhookUrl = options.webhookUrl;
    this.timeoutMs = options.timeoutMs ?? 20000;
  }

  public async sendMessage(envelope: N8nMessageEnvelope): Promise<N8nMessageResponse> {
    let response: Response;

    try {
      response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelope),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (error: any) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new ServiceUnavailableError(
          'AI mentor service timed out waiting for response. Please try again.'
        );
      }
      throw new BadGatewayError('Could not reach AI mentor service. Please try again later.');
    }

    if (!response.ok) {
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
        audioSource: null
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

    return {
      text: text || 'Namaskara! I am listening.',
      audioSource: toAudioSource(rawAudio),
      raw: parsed
    };
  }
}
