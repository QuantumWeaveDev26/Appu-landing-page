import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import * as Speech from 'expo-speech';
import Voice, {
  type SpeechResultsEvent,
  type SpeechErrorEvent,
} from '@react-native-voice/voice';
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
  private isSpeechActive = false;

  /**
   * Resolves language code into standard locale identifier for STT / TTS.
   */
  public getLocale(language?: string): string {
    switch (language) {
      case 'kn':
        return 'kn-IN';
      case 'hi':
        return 'hi-IN';
      case 'en':
      default:
        return 'en-IN';
    }
  }

  /**
   * Plays Appu's voice:
   * 1. Prioritizes server-authorized Eleven v3 audio stream (audioStreamUrl with custom auth header).
   * 2. Direct audio URL (audioSource).
   * 3. Fallback to device TTS (expo-speech).
   */
  public async playAppuVoice(options: PlaybackOptions): Promise<void> {
    this.stopPlayback();

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
            onFinish?.();
          }
        });

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
            onFinish?.();
          }
        });

        onStart?.();
        player.play();
        return;
      } catch (err) {
        console.warn('[VoiceService] Failed to play direct audio source; trying TTS fallback:', err);
      }
    }

    // 3. Fallback to device Text-To-Speech (expo-speech)
    if (text && text.trim()) {
      try {
        this.isSpeechActive = true;
        const locale = this.getLocale(language);
        onStart?.();

        Speech.speak(text, {
          language: locale,
          pitch: 1.05, // Slightly cheerful pitch for Appu
          rate: 0.95,
          onDone: () => {
            this.isSpeechActive = false;
            onFinish?.();
          },
          onError: (e) => {
            this.isSpeechActive = false;
            onError?.(e);
            onFinish?.();
          },
        });
      } catch (ttsErr) {
        this.isSpeechActive = false;
        onError?.(ttsErr);
        onFinish?.();
      }
    } else {
      onFinish?.();
    }
  }

  /**
   * Stops all active playback (audio player or device TTS).
   */
  public stopPlayback(): void {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
        this.currentPlayer.remove();
      } catch {}
      this.currentPlayer = null;
    }

    if (this.isSpeechActive) {
      try {
        Speech.stop();
      } catch {}
      this.isSpeechActive = false;
    }
  }

  /**
   * Starts native speech recognition.
   */
  public async startListening(
    language: string,
    callbacks: {
      onStart?: () => void;
      onPartial?: (text: string) => void;
      onResults?: (text: string) => void;
      onError?: (err: any) => void;
    }
  ): Promise<void> {
    this.stopPlayback();

    try {
      Voice.removeAllListeners();

      Voice.onSpeechStart = () => {
        callbacks.onStart?.();
      };

      Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
        if (e.value && e.value.length > 0) {
          callbacks.onPartial?.(e.value[0]);
        }
      };

      Voice.onSpeechResults = (e: SpeechResultsEvent) => {
        if (e.value && e.value.length > 0) {
          callbacks.onResults?.(e.value[0]);
        }
      };

      Voice.onSpeechError = (e: SpeechErrorEvent) => {
        callbacks.onError?.(e);
      };

      const locale = this.getLocale(language);
      await Voice.start(locale);
    } catch (err) {
      callbacks.onError?.(err);
    }
  }

  /**
   * Stops listening and waits for final transcript.
   */
  public async stopListening(): Promise<void> {
    try {
      await Voice.stop();
    } catch {}
  }

  /**
   * Cancels listening and ignores transcript.
   */
  public async cancelListening(): Promise<void> {
    try {
      await Voice.cancel();
      Voice.removeAllListeners();
    } catch {}
  }
}

export const voiceService = new VoiceService();
