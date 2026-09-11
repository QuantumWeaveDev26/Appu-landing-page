import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { config } from '../config';
import { useSettingsStore } from '../stores/settingsStore';

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
  private recognitionSubscriptions: { remove: () => void }[] = [];

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
        const settings = useSettingsStore.getState();
        onStart?.();

        Speech.speak(text, {
          language: locale,
          pitch: settings.voicePitch,
          rate: settings.voiceRate,
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
   * Plays a quick preview sentence to test current voice rate and pitch.
   */
  public testVoice(
    language: 'en' | 'kn' | 'hi' = 'en',
    customRate?: number,
    customPitch?: number
  ): void {
    this.stopPlayback();
    const settings = useSettingsStore.getState();
    const rate = customRate ?? settings.voiceRate;
    const pitch = customPitch ?? settings.voicePitch;
    const locale = this.getLocale(language);

    const previewPhrases: Record<'en' | 'kn' | 'hi', string> = {
      en: 'Hello! I am Appu, your AI learning friend. How can I help you today?',
      kn: 'ನಮಸ್ಕಾರ! ನಾನು ಅಪ್ಪು, ನಿಮ್ಮ ಕಲಿಕೆಯ ಸ್ನೇಹಿತ. ಇಂದು ಏನು ಕಲಿಯೋಣ?',
      hi: 'नमस्ते! मैं अप्पू हूँ, आपका सीखने का साथी। आज हम क्या नया सीखेंगे?',
    };

    Speech.speak(previewPhrases[language] || previewPhrases.en, {
      language: locale,
      pitch,
      rate,
    });
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

  private clearRecognitionSubscriptions(): void {
    for (const sub of this.recognitionSubscriptions) {
      try {
        sub.remove();
      } catch {}
    }
    this.recognitionSubscriptions = [];
  }

  /**
   * Starts native speech recognition via expo-speech-recognition.
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
    this.clearRecognitionSubscriptions();

    try {
      const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perms.granted) {
        callbacks.onError?.(new Error('Microphone/Speech permission not granted'));
        return;
      }

      this.recognitionSubscriptions.push(
        ExpoSpeechRecognitionModule.addListener('start', () => {
          callbacks.onStart?.();
        })
      );

      this.recognitionSubscriptions.push(
        ExpoSpeechRecognitionModule.addListener('result', (ev) => {
          const transcript = ev.results?.[0]?.transcript || '';
          if (transcript) {
            if (ev.isFinal) {
              callbacks.onResults?.(transcript);
            } else {
              callbacks.onPartial?.(transcript);
            }
          }
        })
      );

      this.recognitionSubscriptions.push(
        ExpoSpeechRecognitionModule.addListener('error', (ev) => {
          callbacks.onError?.(ev.message || ev.error);
        })
      );

      const locale = this.getLocale(language);
      ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        continuous: false,
      });
    } catch (err) {
      callbacks.onError?.(err);
    }
  }

  /**
   * Stops listening and waits for final transcript.
   */
  public async stopListening(): Promise<void> {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
  }

  /**
   * Cancels listening and ignores transcript.
   */
  public async cancelListening(): Promise<void> {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}
    this.clearRecognitionSubscriptions();
  }
}

export const voiceService = new VoiceService();
