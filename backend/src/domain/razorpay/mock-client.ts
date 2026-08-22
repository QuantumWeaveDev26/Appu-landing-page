import crypto from 'node:crypto';
import type {
  RazorpayClient,
  CreateRazorpaySubscriptionInput,
  RazorpaySubscriptionResult,
  VerifyCheckoutSignatureInput,
  VerifyWebhookSignatureInput
} from './types.js';

export class MockRazorpayClient implements RazorpayClient {
  public secretKey = 'mock_secret_key';
  public webhookSecret = 'mock_webhook_secret';
  public nextSubscriptionId = 'sub_mock_12345';
  public createdSubscriptions: CreateRazorpaySubscriptionInput[] = [];

  public subscriptionStore: Map<string, RazorpaySubscriptionResult> = new Map();

  public async createSubscription(
    input: CreateRazorpaySubscriptionInput
  ): Promise<RazorpaySubscriptionResult> {
    this.createdSubscriptions.push(input);
    const result: RazorpaySubscriptionResult = {
      id: this.nextSubscriptionId,
      planId: input.planId,
      status: 'created',
      shortUrl: `https://rzp.io/i/${this.nextSubscriptionId}`,
      currentStart: null,
      currentEnd: null
    };
    this.subscriptionStore.set(this.nextSubscriptionId, result);
    return result;
  }

  public async getSubscription(subscriptionId: string): Promise<RazorpaySubscriptionResult> {
    const existing = this.subscriptionStore.get(subscriptionId.trim());
    if (existing) {
      return existing;
    }
    return {
      id: subscriptionId.trim(),
      planId: 'plan_mock_123',
      status: 'active',
      currentStart: Math.floor(Date.now() / 1000),
      currentEnd: Math.floor(Date.now() / 1000) + 30 * 86400
    };
  }

  public verifyCheckoutSignature(input: VerifyCheckoutSignatureInput): boolean {
    if (!input.paymentId || !input.subscriptionId || !input.signature) {
      return false;
    }

    const payload = `${input.paymentId.trim()}|${input.subscriptionId.trim()}`;
    const expected = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    return input.signature.trim() === expected;
  }

  public verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
    if (!input.rawBody || !input.signature) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(input.rawBody)
      .digest('hex');

    return input.signature.trim() === expected;
  }
}
