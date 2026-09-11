import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { config } from '../config';

let isConfigured = false;

/**
 * Returns true if a valid Google Web Client ID is configured.
 */
export function isGoogleAuthAvailable(): boolean {
  return Boolean(config.googleWebClientId && config.googleWebClientId.trim().length > 0);
}

function ensureConfigured(): void {
  if (!isConfigured && isGoogleAuthAvailable()) {
    GoogleSignin.configure({
      webClientId: config.googleWebClientId,
      scopes: ['profile', 'email'],
    });
    isConfigured = true;
  }
}

/**
 * Initiates native Google Sign-In flow and returns the resulting ID token.
 * Clears any cached Google session first so the account chooser is always displayed.
 */
export async function promptGoogleSignIn(): Promise<string> {
  if (!isGoogleAuthAvailable()) {
    throw new Error('Google Sign-In is not configured. Google Web Client ID is required.');
  }

  ensureConfigured();

  // Clear cached Google session so the system account chooser always shows
  try {
    await GoogleSignin.signOut();
  } catch {
    // Non-fatal if no user was signed in or already signed out
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;

  if (!idToken) {
    throw new Error('No identity token returned from Google Sign-In');
  }

  return idToken;
}

/**
 * Disconnects the Google session so the account is fully logged out on the device.
 * Guarded to be a no-op if Google auth is not configured.
 */
export async function signOutGoogle(): Promise<void> {
  if (!isGoogleAuthAvailable()) {
    return;
  }

  ensureConfigured();

  try {
    try {
      await GoogleSignin.revokeAccess();
    } catch {
      // Ignored if not signed in or not authorized
    }
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn('[googleAuth] signOut error:', error);
  }
}
