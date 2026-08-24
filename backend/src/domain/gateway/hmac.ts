import crypto from 'node:crypto';

export const APPU_HMAC_SIGNATURE_VERSION = 'v1';

export function createAppuHmacSignature(
  rawBody: string,
  timestampSeconds: string,
  secret: string
): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`${timestampSeconds}.${rawBody}`, 'utf8')
    .digest('hex');
  return `${APPU_HMAC_SIGNATURE_VERSION}=${digest}`;
}

export type AppuHmacVerificationFailure =
  | 'missing'
  | 'malformed'
  | 'stale'
  | 'mismatch';

export function verifyAppuHmacSignature(input: {
  rawBody: string;
  timestampHeader?: string | null;
  signatureHeader?: string | null;
  secret: string;
  now?: () => number;
  maxAgeSeconds?: number;
}): { valid: true } | { valid: false; reason: AppuHmacVerificationFailure } {
  const timestamp = input.timestampHeader?.trim();
  const signature = input.signatureHeader?.trim();
  if (!timestamp || !signature) return { valid: false, reason: 'missing' };
  if (!/^\d{10,13}$/.test(timestamp) || !/^v1=[0-9a-f]{64}$/i.test(signature)) {
    return { valid: false, reason: 'malformed' };
  }

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? Date.now)() / 1000);
  const maxAgeSeconds = input.maxAgeSeconds ?? 300;
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > maxAgeSeconds) {
    return { valid: false, reason: 'stale' };
  }

  const expected = createAppuHmacSignature(input.rawBody, timestamp, input.secret).slice(3);
  const provided = signature.slice(3);
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { valid: false, reason: 'mismatch' };
  }
  return { valid: true };
}
