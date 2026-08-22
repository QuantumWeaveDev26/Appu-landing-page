import crypto from 'node:crypto';
import type {
  RazorpayClient,
  CreateRazorpaySubscriptionInput,
  RazorpaySubscriptionResult,
  VerifyCheckoutSignatureInput,
  VerifyWebhookSignatureInput
} from './types.js';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  baseUrl?: string;
}

export class DefaultRazorpayClient implements RazorpayClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret?: string;
  private readonly baseUrl: string;

  constructor(config: RazorpayConfig) {
    if (!config.keyId || !config.keySecret) {
      throw new Error('Razorpay keyId and keySecret are required');
    }
    this.keyId = config.keyId.trim();
    this.keySecret = config.keySecret.trim();
    this.webhookSecret = config.webhookSecret?.trim();
    this.baseUrl = config.baseUrl || 'https://api.razorpay.com/v1';
  }

  /**
   * Creates a subscription in Razorpay (TEST MODE).
   */
  public async createSubscription(
    input: CreateRazorpaySubscriptionInput
  ): Promise<RazorpaySubscriptionResult> {
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: input.planId,
        total_count: input.totalCount ?? 12,
        customer_notify: input.customerNotify ?? 1,
        notes: input.notes
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Razorpay subscription creation failed (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    return {
      id: data.id,
      planId: data.plan_id,
      status: data.status,
      shortUrl: data.short_url,
      currentStart: data.current_start ?? null,
      currentEnd: data.current_end ?? null
    };
  }

  /**
   * Fetches authoritative subscription details from Razorpay (server-to-server).
   */
  public async getSubscription(subscriptionId: string): Promise<RazorpaySubscriptionResult> {
    if (!subscriptionId || !subscriptionId.trim()) {
      throw new Error('subscriptionId is required for getSubscription');
    }

    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;

    const response = await fetch(`${this.baseUrl}/subscriptions/${encodeURIComponent(subscriptionId.trim())}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Razorpay getSubscription failed (${response.status}): ${errText}`);
    }

    const data = await response.json() as any;
    return {
      id: data.id,
      planId: data.plan_id,
      status: data.status,
      shortUrl: data.short_url,
      currentStart: data.current_start ?? null,
      currentEnd: data.current_end ?? null
    };
  }

  /**
   * Verifies standard checkout signature:
   * HMAC_SHA256(payment_id + "|" + subscription_id, key_secret)
   */
  public verifyCheckoutSignature(input: VerifyCheckoutSignatureInput): boolean {
    if (!input.paymentId || !input.subscriptionId || !input.signature) {
      return false;
    }

    try {
      const payload = `${input.paymentId.trim()}|${input.subscriptionId.trim()}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(payload)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(input.signature.trim(), 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Verifies Razorpay webhook signature:
   * HMAC_SHA256(raw_body, webhook_secret)
   */
  public verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
    if (!this.webhookSecret || !input.rawBody || !input.signature) {
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(input.rawBody)
        .digest('hex');

      const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
      const actualBuffer = Buffer.from(input.signature.trim(), 'utf8');

      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    } catch {
      return false;
    }
  }
}
