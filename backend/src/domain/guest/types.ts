export interface GuestSession {
  id: string;
  ipHash: string;
  usedTurns: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface GuestSessionTokenPayload {
  id: string;
  turns: number;
  iat: number;
  exp: number;
  ipHash: string;
}

export interface GuestQuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  guestToken: string;
}

export interface GuestStatusResult {
  guestLimit: number;
  used: number;
  remaining: number;
  loginRequired: boolean;
  token: string;
}
