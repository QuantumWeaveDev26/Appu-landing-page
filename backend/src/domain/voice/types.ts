export const AppuAudioStatuses = {
  PENDING: 'PENDING',
  STREAMING: 'STREAMING',
  COMPLETED: 'COMPLETED',
  EXPIRED: 'EXPIRED'
} as const;

export type AppuAudioStatus = (typeof AppuAudioStatuses)[keyof typeof AppuAudioStatuses];

export interface AppuAudioAuthorizationRecord {
  requestId: string;
  householdId: string;
  childId: string | null;
  approvedText: string;
  language: string;
  audioStatus: AppuAudioStatus;
  streamCount: number;
  createdAt: Date;
  expiresAt: Date;
}
