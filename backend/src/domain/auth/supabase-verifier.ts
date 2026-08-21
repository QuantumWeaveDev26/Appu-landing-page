import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { UnauthorizedError } from '../../errors/index.js';
import type { AuthVerifier, AuthenticatedPrincipal } from './types.js';

export interface SupabaseAuthVerifierConfig {
  supabaseUrl: string;
  supabaseKey: string;
}

/**
 * SupabaseAuthVerifier performs server-side access token verification
 * using the official Supabase Auth client.
 */
export class SupabaseAuthVerifier implements AuthVerifier {
  private readonly client: SupabaseClient;

  constructor(config: SupabaseAuthVerifierConfig) {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Supabase URL and Key are required for SupabaseAuthVerifier');
    }

    this.client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }

  public async verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedError('Invalid or missing authentication token');
    }

    try {
      const { data, error } = await this.client.auth.getUser(token.trim());

      if (error || !data?.user) {
        throw new UnauthorizedError('Invalid or expired authentication token');
      }

      const user = data.user;
      if (!user.id) {
        throw new UnauthorizedError('Token subject does not contain a valid user identity');
      }

      return {
        userId: user.id,
        email: user.email
      };
    } catch (err: any) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      // Never expose provider error details, stack traces, or raw tokens
      throw new UnauthorizedError('Authentication verification failed');
    }
  }
}
