import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error.js';
import { ErrorCodes } from './codes.js';

export function fastifyErrorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      request.log.error({ err: error }, error.message);
    } else {
      request.log.warn({ err: error, code: error.code }, error.message);
    }

    return reply.status(error.statusCode).send(error.toJSON());
  }

  // Handle Fastify validation errors (e.g. schema validation)
  if ('validation' in error && error.validation) {
    request.log.warn({ err: error }, 'Request validation failed');
    return reply.status(400).send({
      error: {
        code: ErrorCodes.INVALID_REQUEST,
        message: 'Invalid request data',
        details: {
          validation: error.validation
        }
      }
    });
  }

  // Handle standard HTTP 404 from Fastify router
  if ('statusCode' in error && error.statusCode === 404) {
    return reply.status(404).send({
      error: {
        code: ErrorCodes.NOT_FOUND,
        message: 'Route not found'
      }
    });
  }

  // Unhandled / unexpected errors
  const reqId = request.id || (request.headers['x-request-id'] as string) || 'unknown';
  const appuRequestId =
    (request.headers['x-appu-request-id'] as string) ||
    (request as any).appuRequestId ||
    undefined;

  // Safe structured log to stderr for immediate operational visibility without secret leakage
  console.error('[APPU Backend Unhandled Error]', {
    requestId: reqId,
    ...(appuRequestId ? { appuRequestId } : {}),
    method: request.method,
    url: request.url,
    errorName: error.name || 'Error',
    errorMessage: error.message || 'Unknown error',
    stack: error.stack
  });

  request.log.error({ err: error, reqId, appuRequestId }, 'Unhandled server error');

  return reply.status(500).send({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'An unexpected internal error occurred'
    }
  });
}
