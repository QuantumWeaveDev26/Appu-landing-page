import { UnauthorizedError } from '../../errors/index.js';
import type { AuthVerifier, AuthenticatedPrincipal } from './types.js';

/**
 * MockAuthVerifier provides deterministic token verification for tests.
 */
export class MockAuthVerifier implements AuthVerifier {
  private readonly tokens = new Map<string, AuthenticatedPrincipal>();

  /**
   * Pre-registers a valid token and its associated principal.
   */
  public registerToken(token: string, principal: AuthenticatedPrincipal): this {
    this.tokens.set(token.trim(), principal);
    return this;
  }

  public clearTokens(): void {
    this.tokens.clear();
  }

  public async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedError('Invalid or missing authentication token');
    }

    const principal = this.tokens.get(token.trim());
    if (!principal) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    return {
      userId: principal.userId,
      email: principal.email
    };
  }
}
