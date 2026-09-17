export interface SessionUsage {
  sessionId: string;
  householdId: string;
  childId: string;
  activeSeconds: number;
  awaySeconds: number;
  windowStartedAt: Date;
  updatedAt: Date;
}

export interface ParentSessionOtp {
  id: string;
  householdId: string;
  childId: string;
  sessionId: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface HeartbeatInput {
  sessionId: string;
  childId: string;
  activeMsSinceLast?: number;
  awayMsSinceLast?: number;
  visibility?: 'visible' | 'hidden';
}

export interface HeartbeatResult {
  enabled: boolean;
  locked: boolean;
  activeSeconds: number;
  awaySeconds: number;
  timeRemainingSeconds: number;
}

export interface RequestOtpInput {
  sessionId: string;
  childId: string;
}

export interface RequestOtpResult {
  requested: boolean;
  needsPhone?: boolean;
  error?: string;
  retryAfterSeconds?: number;
  expiresInSeconds?: number;
  activeSeconds?: number;
  awaySeconds?: number;
}

export interface VerifyOtpInput {
  sessionId: string;
  childId: string;
  code: string;
}

export interface VerifyOtpResult {
  verified: boolean;
  windowReset?: boolean;
  attemptsLeft?: number;
  error?: string;
  lockedOut?: boolean;
}

export interface SendNoteInput {
  childId: string;
  note: string;
}

export interface SendNoteResult {
  sent: boolean;
  needsPhone?: boolean;
  disabled?: boolean;
  error?: string;
}

export interface SessionUsageResult {
  enabled: boolean;
  locked: boolean;
  activeSeconds: number;
  awaySeconds: number;
  timeRemainingSeconds: number;
}
