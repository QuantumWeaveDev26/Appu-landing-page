import type { EntitlementsMap } from '../entitlements/types.js';

export const SubscriptionStates = {
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  AUTHENTICATED: 'AUTHENTICATED',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  HALTED: 'HALTED',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED'
} as const;

export type SubscriptionState = (typeof SubscriptionStates)[keyof typeof SubscriptionStates];

export const ALL_SUBSCRIPTION_STATES: readonly SubscriptionState[] = Object.values(SubscriptionStates);

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  amountPaise: number;
  billingInterval: string;
  isActive: boolean;
  providerPlanId: string | null;
  entitlements?: EntitlementsMap;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  householdId: string;
  planId: string;
  planCode?: string;
  provider: string;
  providerSubscriptionId: string | null;
  status: SubscriptionState;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentEvent {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  subscriptionId: string | null;
  providerSubscriptionId: string | null;
  status: string;
  payloadSummary: Record<string, unknown> | null;
  processedAt: Date;
  createdAt: Date;
}

export interface CreateSubscriptionInput {
  householdId: string;
  planId: string;
  provider?: string;
  providerSubscriptionId?: string | null;
  status?: SubscriptionState;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
}
