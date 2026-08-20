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
