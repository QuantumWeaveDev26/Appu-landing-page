/**
 * APPU Native App Configuration
 * Ported from frontend/appu-config.js.
 * STRICT INVARIANT: Safe client configuration only. No server secrets.
 */
export interface AppConfig {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  betaMode: boolean;
  betaChatLimit: number;
  googleWebClientId: string;
}

export const config: AppConfig = {
  apiBaseUrl: 'https://api.appuai.online',
  supabaseUrl: 'https://cmulkkpinwernuzhtegp.supabase.co',
  supabaseAnonKey: 'sb_publishable_N-I0xWkc2SXY6kga0iD0_Q_awDjKXNr',
  betaMode: true,
  betaChatLimit: 30,
  googleWebClientId: '191112449176-o48v15ln9geb6i0rev1g8h50tekph5hu.apps.googleusercontent.com',
};
