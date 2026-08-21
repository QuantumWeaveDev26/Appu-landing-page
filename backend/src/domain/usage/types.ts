export type UsageMetric = 'ai_sessions' | 'voice_seconds' | 'voice_duration_ms';
export type UsageStatus = 'reserved' | 'committed' | 'released';

export interface UsageRecord {
  id: string;
  householdId: string;
  subscriptionId: string;
  childId?: string | null;
  metric: UsageMetric;
  quantity: number;
  status: UsageStatus;
  periodStart: Date;
  periodEnd: Date;
  idempotencyKey?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsagePeriod {
  startsAt: Date;
  endsAt: Date;
  source: 'provider' | 'fallback';
}

export interface UsageSummary {
  period: {
    startsAt: string;
    endsAt: string;
    source: 'provider' | 'fallback';
  };
  aiSessions: {
    used: number;
    limit: number;
    remaining: number;
  };
  voiceMinutes: {
    used: number | null;
    limit: number;
    remaining: number | null;
    meteringStatus: 'pending' | 'active';
  };
}

export interface ReserveUsageInput {
  householdId: string;
  subscriptionId: string;
  childId?: string | null;
  metric: UsageMetric;
  quantity: number;
  quotaLimit: number;
  idempotencyKey?: string | null;
  requestFingerprint?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordVoiceUsageInput {
  householdId: string;
  subscriptionId: string;
  childId?: string | null;
  durationMs: number;
  quotaLimitMs: number;
  idempotencyKey?: string | null;
  requestFingerprint?: string | null;
  metadata?: Record<string, unknown>;
}

export interface VoiceUsageRecordResult {
  record: UsageRecord | null;
  delivered: boolean;
  remainingMs: number;
  isExisting: boolean;
}

export interface UsageReservationResult {
  reservationId: string;
  isExisting: boolean;
  periodStart: Date;
  periodEnd: Date;
  usedBeforeReservation: number;
  remainingAfterReservation: number;
}
