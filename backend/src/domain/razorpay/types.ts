export interface CreateRazorpaySubscriptionInput {
  planId: string;
  totalCount?: number;
  customerNotify?: boolean;
  notes?: Record<string, string>;
}

export interface RazorpaySubscriptionResult {
  id: string;
  planId: string;
  status: string;
  shortUrl?: string;
}

export interface VerifyCheckoutSignatureInput {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}

export interface VerifyWebhookSignatureInput {
  rawBody: string;
  signature: string;
}

export interface RazorpayClient {
  createSubscription(input: CreateRazorpaySubscriptionInput): Promise<RazorpaySubscriptionResult>;
  verifyCheckoutSignature(input: VerifyCheckoutSignatureInput): boolean;
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean;
}
