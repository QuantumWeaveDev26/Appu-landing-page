import { ErrorCodes, type AppErrorCode } from './codes.js';

export interface AppErrorPayload {
  code: AppErrorCode;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(payload: AppErrorPayload) {
    super(payload.message);
    this.name = 'AppError';
    this.code = payload.code;
    this.statusCode = payload.statusCode ?? 500;
    this.details = payload.details;
    this.isOperational = payload.isOperational ?? true;

    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {})
      }
    };
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: ErrorCodes.INVALID_REQUEST,
      message,
      statusCode: 400,
      details
    });
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super({
      code: ErrorCodes.UNAUTHORIZED,
      message,
      statusCode: 401
    });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super({
      code: ErrorCodes.FORBIDDEN,
      message,
      statusCode: 403
    });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: 404
    });
    this.name = 'NotFoundError';
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(fromState: string, toState: string, reason?: string) {
    super({
      code: ErrorCodes.INVALID_STATE_TRANSITION,
      message: `Invalid subscription transition from '${fromState}' to '${toState}'${reason ? `: ${reason}` : ''}`,
      statusCode: 422,
      details: {
        fromState,
        toState,
        ...(reason ? { reason } : {})
      }
    });
    this.name = 'InvalidStateTransitionError';
  }
}

export class InvalidEntitlementValueError extends AppError {
  constructor(key: string, expectedType: string, actualValue: unknown, reason?: string) {
    super({
      code: ErrorCodes.INVALID_ENTITLEMENT_VALUE,
      message: `Invalid value for entitlement '${key}'. Expected ${expectedType}${reason ? `: ${reason}` : ''}`,
      statusCode: 422,
      details: {
        key,
        expectedType,
        actualType: typeof actualValue,
        ...(reason ? { reason } : {})
      }
    });
    this.name = 'InvalidEntitlementValueError';
  }
}

export class QuotaExceededError extends AppError {
  constructor(resource: string, limit: number, current: number) {
    super({
      code: ErrorCodes.QUOTA_EXCEEDED,
      message: `Usage quota exceeded for ${resource}`,
      statusCode: 429,
      details: { resource, limit, current }
    });
    this.name = 'QuotaExceededError';
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super({
      code: ErrorCodes.SERVICE_TEMPORARILY_UNAVAILABLE,
      message,
      statusCode: 503
    });
    this.name = 'ServiceUnavailableError';
  }
}
