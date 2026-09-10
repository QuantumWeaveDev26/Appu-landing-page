import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { config } from '../config';

let isConfigured = false;

/**
 * Returns true if a valid Google Web Client ID is configured.
 */
export function isGoogleAuthAvailable(): boolean {
  return Boolean(config.googleWebClientId && config.googleWebClientId.trim().length > 0);
}

/**
 * Initiates native Google Sign-In flow and returns the resulting ID token.
 */
export async function promptGoogleSignIn(): Promise<string> {
  if (!isGoogleAuthAvailable()) {
    throw new Error('Google Sign-In is not configured. Google Web Client ID is required.');
  }

  if (!isConfigured) {
    GoogleSignin.configure({
      webClientId: config.googleWebClientId,
      scopes: ['profile', 'email'],
    });
    isConfigured = true;
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  const idToken = response.data?.idToken;

  if (!idToken) {
    throw new Error('No identity token returned from Google Sign-In');
  }

  return idToken;
}
