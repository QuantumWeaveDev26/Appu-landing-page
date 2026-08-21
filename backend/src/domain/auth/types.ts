/**
 * AuthenticatedPrincipal represents a verified user identity
 * established securely by an AuthVerifier.
 *
 * SECURITY INVARIANT:
 * The `userId` must come ONLY from the verified authentication provider token subject.
 * Never populate this from browser-supplied headers, request bodies, or query params.
 */
export interface AuthenticatedPrincipal {
  userId: string;
  email?: string;
}

/**
 * AuthVerifier abstracts server-side access token verification.
 */
export interface AuthVerifier {
  /**
   * Verifies an access token and returns the trusted AuthenticatedPrincipal.
   * Throws UnauthorizedError if the token is invalid, expired, or malformed.
   */
  verifyAccessToken(token: string): Promise<AuthenticatedPrincipal>;
}
