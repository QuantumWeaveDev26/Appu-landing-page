export const AppuRequestStates = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  DEFINITE_FAILURE: 'DEFINITE_FAILURE',
  UNKNOWN: 'UNKNOWN'
} as const;

export type AppuRequestState = (typeof AppuRequestStates)[keyof typeof AppuRequestStates];
export type AppuRequestActorType = 'authenticated' | 'guest';

export interface AppuRequestRecord {
  id: string;
  actorType: AppuRequestActorType;
  householdId: string | null;
  subscriptionId: string | null;
  guestSessionId: string | null;
  usageRecordId: string | null;
  idempotencyKey: string;
  requestFingerprint: string;
  status: AppuRequestState;
  downstreamExecutionId: string | null;
  failureCode: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

