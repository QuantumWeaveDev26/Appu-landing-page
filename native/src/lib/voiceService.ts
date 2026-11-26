import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';
import { config } from '../config';

export interface PlaybackOptions {
  audioStreamUrl?: string | null;
  audioSource?: string | null;
  text: string;
  language?: 'en' | 'kn' | 'hi';
  accessToken?: string | null;
  guestToken?: string | null;
  onStart?: () => void;
  onFinish?: () => void;
  onError?: (err: any) => void;
}

class VoiceService {
  private currentPlayer: AudioPlayer | null = null;
  /** True while Appu's voice is playing; `speakingText` is what it is saying (for the echo filter). */
  public isSpeaking = false;
  public speakingText = '';
  /** Called when Appu finishes speaking on its own (not when stopped), so listening can resume. */
  public onIdle: (() => void) | null = null;

  /** Lets Appu's voice and the microphone run together (needed for talking over Appu). */
  public prepareForLive(): void {
    try {
      void setAudioModeAsync?.({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: 'mixWithOthers',
        shouldRouteThroughEarpiece: false,
      })?.catch?.(() => {});
    } catch {}
  }

  /**
   * Plays Appu's voice:
   * 1. Prioritizes server-authorized Eleven v3 audio stream (audioStreamUrl with custom auth header).
   * 2. Direct audio URL (audioSource).
   * Only APPU's ElevenLabs voice ever plays: there is no device text-to-speech fallback.
   */
  public async playAppuVoice(options: PlaybackOptions): Promise<void> {
    this.stopPlayback();
    this.speakingText = options.text || '';

    const {
      audioStreamUrl,
      audioSource,
      text,
      language = 'en',
      accessToken,
      guestToken,
      onStart,
      onFinish,
      onError,
    } = options;

    // 1. Try streaming server-generated Eleven v3 audio
    if (audioStreamUrl) {
      try {
        const fullUrl = audioStreamUrl.startsWith('http')
          ? audioStreamUrl
          : `${config.apiBaseUrl.replace(/\/+$/, '')}${audioStreamUrl.startsWith('/') ? '' : '/'}${audioStreamUrl}`;

        const headers: Record<string, string> = {};
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        } else if (guestToken) {
          headers['X-Guest-Session-Token'] = guestToken;
        }

        const source: AudioSource = {
          uri: fullUrl,
          headers,
        };

        const player = createAudioPlayer(source);
        this.currentPlayer = player;

        player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            this.currentPlayer = null;
            this.isSpeaking = false;
            onFinish?.();
            this.onIdle?.();
          }
        });

        this.isSpeaking = true;
        onStart?.();
        player.play();
        return;
      } catch (err) {
        console.warn('[VoiceService] Failed to stream backend audio; trying fallback:', err);
      }
    }

    // 2. Direct audio source URL fallback
    if (audioSource) {
      try {
        const player = createAudioPlayer({ uri: audioSource });
        this.currentPlayer = player;

        player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) {
            this.currentPlayer = null;
            this.isSpeaking = false;
            onFinish?.();
            this.onIdle?.();
          }
        });

        this.isSpeaking = true;
        onStart?.();
        player.play();
        return;
      } catch (err) {
        console.warn('[VoiceService] Failed to play direct audio source; no voice played:', err);
      }
    }

    // No server audio: the reply stays as text only.
    onFinish?.();
  }

  /**
   * Stops all active playback (audio player or device TTS).
   */
  public stopPlayback(): void {
    this.isSpeaking = false;
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
        this.currentPlayer.remove();
      } catch {}
      this.currentPlayer = null;
    }
  }
}

export const voiceService = new VoiceService();
