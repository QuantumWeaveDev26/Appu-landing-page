export const ErrorCodes = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  INVALID_CHILD: 'invalid_child',
  SUBSCRIPTION_REQUIRED: 'subscription_required',
  SUBSCRIPTION_INACTIVE: 'subscription_inactive',
  PAYMENT_PROCESSING: 'payment_processing',
  PAYMENT_FAILED: 'payment_failed',
  QUOTA_EXCEEDED: 'quota_exceeded',
  VOICE_QUOTA_EXCEEDED: 'voice_quota_exceeded',
  RATE_LIMITED: 'rate_limited',
  INVALID_REQUEST: 'invalid_request',
  NOT_FOUND: 'not_found',
  SERVICE_TEMPORARILY_UNAVAILABLE: 'service_temporarily_unavailable',
  INTERNAL_ERROR: 'internal_error',
  INVALID_STATE_TRANSITION: 'invalid_state_transition',
  INVALID_ENTITLEMENT_VALUE: 'invalid_entitlement_value'
} as const;

export type AppErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
