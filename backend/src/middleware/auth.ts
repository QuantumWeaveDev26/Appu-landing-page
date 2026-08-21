import type { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/index.js';
import type { AuthVerifier, AuthenticatedPrincipal } from '../domain/auth/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

/**
 * Creates a Fastify preHandler hook that enforces Bearer token authentication
 * via the configured AuthVerifier.
 */
export function createAuthPreHandler(authVerifier: AuthVerifier) {
  return async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('Missing Authorization header');
    }

    const parts = authHeader.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedError('Malformed Authorization header. Expected "Bearer <token>"');
    }

    const token = parts[1];
    const principal = await authVerifier.verifyAccessToken(token);

    // Attach verified principal to request context
    request.principal = principal;
  };
}
