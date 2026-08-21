/**
 * Pure-TypeScript Server-Side Audio Duration Parser
 *
 * Deterministically parses audio duration in milliseconds from:
 * 1. Explicit authoritative provider duration metadata (if positive finite integer).
 * 2. Raw MP3 (MPEG-1/2/2.5 Layer III) audio stream frames.
 * 3. Raw WAV (RIFF/WAVE PCM/IEEE Float) audio headers.
 *
 * SECURITY & INTEGRITY INVARIANTS:
 * - Deterministic, pure server-side measurement.
 * - Never estimates based on text length, word count, or character counts.
 * - Never accepts client-supplied or untrusted browser duration values.
 * - Returns null if audio data is invalid, empty, or unparseable.
 */

const MPEG1_L3_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const MPEG2_L3_BITRATES = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000]   // MPEG-2.5
};

/**
 * Extracts raw binary Buffer from a base64 string or data URI.
 */
export function extractAudioBuffer(audioSource: string | Buffer | null | undefined): Buffer | null {
  if (!audioSource) return null;

  if (Buffer.isBuffer(audioSource)) {
    return audioSource.length > 0 ? audioSource : null;
  }

  if (typeof audioSource !== 'string') return null;

  const trimmed = audioSource.trim();
  if (!trimmed) return null;

  try {
    // If Data URI: data:audio/mpeg;base64,...
    const commaIdx = trimmed.indexOf(',');
    const base64Str = commaIdx !== -1 && trimmed.startsWith('data:')
      ? trimmed.slice(commaIdx + 1)
      : trimmed;

    // Check if it's base64 encoded
    const buf = Buffer.from(base64Str, 'base64');
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

/**
 * Parses MP3 (MPEG audio) stream frames and computes total duration in milliseconds.
 */
export function parseMp3DurationMs(buf: Buffer): number | null {
  if (!buf || buf.length < 10) return null;

  let offset = 0;

  // 1. Skip ID3v2 tag if present
  if (buf.toString('ascii', 0, 3) === 'ID3') {
    const size =
      ((buf[6] & 0x7f) << 21) |
      ((buf[7] & 0x7f) << 14) |
      ((buf[8] & 0x7f) << 7) |
      (buf[9] & 0x7f);
    offset = 10 + size;
  }

  let totalSamples = 0;
  let sampleRate = 0;
  let frameCount = 0;

  // Scan MPEG frames
  while (offset < buf.length - 4) {
    // Sync word: 11 bits set to 1 (0xFF and top 3 bits of next byte)
    if (buf[offset] === 0xff && (buf[offset + 1] & 0xe0) === 0xe0) {
      const ver = (buf[offset + 1] >> 3) & 0x03;   // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
      const layer = (buf[offset + 1] >> 1) & 0x03; // 1 = Layer III (MP3), 2 = Layer II, 3 = Layer I
      const brIdx = (buf[offset + 2] >> 4) & 0x0f;
      const srIdx = (buf[offset + 2] >> 2) & 0x03;
      const pad = (buf[offset + 2] >> 1) & 0x01;

      if (ver !== 1 && layer === 1 && brIdx > 0 && brIdx < 15 && srIdx < 3) {
        const srTable = SAMPLE_RATES[ver];
        if (srTable && srTable[srIdx]) {
          const sr = srTable[srIdx];
          sampleRate = sr;

          const isMpeg1 = ver === 3;
          const bitrates = isMpeg1 ? MPEG1_L3_BITRATES : MPEG2_L3_BITRATES;
          const br = bitrates[brIdx] * 1000;
          const samplesPerFrame = isMpeg1 ? 1152 : 576;
          const frameLen = Math.floor(((isMpeg1 ? 144 : 72) * br) / sr) + pad;

          if (frameLen > 0) {
            totalSamples += samplesPerFrame;
            frameCount++;
            offset += frameLen;
            continue;
          }
        }
      }
    }
    offset++;
  }

  if (frameCount > 0 && sampleRate > 0) {
    const durationMs = Math.round((totalSamples / sampleRate) * 1000);
    return durationMs > 0 ? durationMs : null;
  }

  return null;
}

/**
 * Parses WAV (RIFF/WAVE) audio file and computes duration in milliseconds.
 */
export function parseWavDurationMs(buf: Buffer): number | null {
  if (!buf || buf.length < 44) return null;

  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;

  while (offset < buf.length - 8) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);

    if (chunkId === 'fmt ' && chunkSize >= 16) {
      byteRate = buf.readUInt32LE(offset + 16);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (byteRate > 0 && dataSize > 0) {
    const durationMs = Math.round((dataSize / byteRate) * 1000);
    return durationMs > 0 ? durationMs : null;
  }

  return null;
}

/**
 * Parses exact authoritative duration in milliseconds from audio data and optional metadata.
 *
 * @param audioSource Base64 string, data URI, or binary Buffer
 * @param explicitDurationMs Optional authoritative duration provided by provider payload
 */
export function parseAudioDuration(
  audioSource: string | Buffer | null | undefined,
  explicitDurationMs?: unknown
): number | null {
  // 1. If explicit authoritative provider duration metadata is present and valid
  if (typeof explicitDurationMs === 'number' && Number.isFinite(explicitDurationMs) && explicitDurationMs > 0) {
    return Math.round(explicitDurationMs);
  }

  // 2. Extract binary buffer
  const buf = extractAudioBuffer(audioSource);
  if (!buf) return null;

  // 3. Try WAV parser
  const wavDuration = parseWavDurationMs(buf);
  if (wavDuration !== null) {
    return wavDuration;
  }

  // 4. Try MP3 parser
  const mp3Duration = parseMp3DurationMs(buf);
  if (mp3Duration !== null) {
    return mp3Duration;
  }

  return null;
}
