/**
 * Always-on listening for the mic button (voice typing) and the call screen, like the website's
 * VoiceEngine live session:
 * - the mic stays on until the learner turns it off (it restarts itself after silence or errors,
 *   and a watchdog brings it back if the phone's recogniser stops without saying so);
 * - while Appu speaks the mic keeps listening; words that are not Appu's own voice coming back
 *   through the speaker interrupt Appu (barge-in);
 * - when Appu stops talking, listening starts fresh so the learner's next turn is heard;
 * - only a blocked microphone switches it off.
 */
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { voiceService } from './voiceService';

export type LiveMode = 'mic' | 'call';

export interface LiveCallbacks {
  onPartial?: (text: string) => void;
  onFinal?: (text: string) => void;
  onBargeIn?: () => void;
  onStopped?: (reason: 'user' | 'blocked') => void;
}

const FATAL = new Set(['not-allowed', 'service-not-allowed', 'language-not-supported']);
const WATCHDOG_MS = 1500;
const START_TIMEOUT_MS = 4000;

/** Words a child uses to stop Appu, in English, Hindi and Kannada. One of these is enough. */
const STOP_WORDS = new Set([
  'stop', 'wait', 'appu', 'hold', 'pause', 'enough', 'no',
  'रुको', 'रुकिए', 'रुक', 'बस', 'अप्पू', 'ruko', 'bas',
  'ನಿಲ್ಲಿಸು', 'ನಿಲ್ಲು', 'ಸಾಕು', 'ಅಪ್ಪು', 'nillu', 'saaku',
]);

function normalizeWords(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** True when the heard words are (mostly) what Appu is saying right now. */
export function isLikelyEcho(heard: string, spoken: string): boolean {
  // Phone recognisers repeat the whole utterance in every update, so judge the newest words.
  const words = normalizeWords(heard).slice(-8);
  if (words.length === 0) return true;
  const said = new Set(normalizeWords(spoken));
  const novel = words.filter((w) => !said.has(w));
  if (novel.some((w) => STOP_WORDS.has(w))) return false;
  return novel.length < Math.max(2, Math.ceil(words.length / 2));
}

/** Removes Appu's own words picked up before the learner started talking. */
export function stripEcho(heard: string, spoken: string): string {
  const said = new Set(normalizeWords(spoken));
  const parts = String(heard || '').trim().split(/\s+/);
  let i = 0;
  while (i < parts.length - 1 && said.has(normalizeWords(parts[i])[0] || '')) i++;
  return parts.slice(i).join(' ');
}

class LiveVoice {
  mode: LiveMode | null = null;
  /** Set while an answer is on its way: finished sentences are ignored until it arrives. */
  awaitingAnswer = false;
  /** True while the phone's recogniser is running. */
  listening = false;
  private callbacks: LiveCallbacks = {};
  private language = 'en';
  private subs: { remove: () => void }[] = [];
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private startedAt = 0;
  private bargedText = '';

  get active() {
    return this.mode !== null;
  }

  private locale() {
    return this.language === 'kn' ? 'kn-IN' : this.language === 'hi' ? 'hi-IN' : 'en-IN';
  }

  async start(mode: LiveMode, language: string, callbacks: LiveCallbacks): Promise<boolean> {
    this.stop('user', false);
    const perms = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perms.granted) {
      callbacks.onStopped?.('blocked');
      return false;
    }
    this.mode = mode;
    this.language = language;
    this.callbacks = callbacks;
    this.awaitingAnswer = false;
    voiceService.prepareForLive?.();

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('start', () => {
        this.listening = true;
      }),
      ExpoSpeechRecognitionModule.addListener('result', (ev) => {
        let text = (ev.results?.[0]?.transcript || '').trim();
        if (!text || !this.active) return;
        if (voiceService.isSpeaking) {
          if (isLikelyEcho(text, voiceService.speakingText)) return;
          this.bargedText = voiceService.speakingText;
          voiceService.stopPlayback();
          this.callbacks.onBargeIn?.();
        }
        if (this.bargedText) text = stripEcho(text, this.bargedText);
        if (ev.isFinal) {
          this.bargedText = '';
          if (this.awaitingAnswer) return;
          this.callbacks.onFinal?.(text);
        } else {
          this.callbacks.onPartial?.(text);
        }
      }),
      ExpoSpeechRecognitionModule.addListener('error', (ev) => {
        if (FATAL.has(ev.error)) {
          this.stop('blocked');
          return;
        }
        // no-speech, network, busy, audio-capture…: try again (some phones send no 'end' after this)
        this.listening = false;
        if (this.active) this.scheduleRestart(ev.error === 'busy' || ev.error === 'client' ? 800 : 300);
      }),
      ExpoSpeechRecognitionModule.addListener('end', () => {
        this.listening = false;
        if (this.active) this.scheduleRestart(300);
      })
    );
    // When Appu finishes (or is interrupted), listen afresh for the learner's turn.
    voiceService.onIdle = () => this.resume();
    this.watchdog = setInterval(() => this.check(), WATCHDOG_MS);
    this.begin();
    return true;
  }

  private begin() {
    if (!this.active) return;
    this.startedAt = Date.now();
    try {
      ExpoSpeechRecognitionModule.start({
        lang: this.locale(),
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
      });
    } catch {
      this.scheduleRestart(800);
    }
  }

  /** Brings the recogniser back if it stopped without telling us or never started. */
  private check() {
    if (!this.active || this.restartTimer || this.listening) return;
    if (Date.now() - this.startedAt > START_TIMEOUT_MS) this.restartNow();
  }

  private restartNow() {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}
    this.listening = false;
    this.scheduleRestart(300);
  }

  private scheduleRestart(delay: number) {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (this.active) this.begin();
    }, delay);
  }

  /** Called when Appu stops talking: start a clean listening turn. */
  resume() {
    if (!this.active) return;
    this.bargedText = '';
    this.restartNow();
  }

  setLanguage(language: string) {
    if (language === this.language) return;
    this.language = language;
    if (this.active) {
      try {
        ExpoSpeechRecognitionModule.abort(); // 'end' restarts it in the new language
      } catch {}
    }
  }

  stop(reason: 'user' | 'blocked' = 'user', notify = true) {
    const wasActive = this.active;
    this.mode = null;
    this.awaitingAnswer = false;
    this.listening = false;
    this.bargedText = '';
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (voiceService.onIdle) voiceService.onIdle = null;
    this.subs.forEach((s) => {
      try {
        s.remove();
      } catch {}
    });
    this.subs = [];
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {}
    if (wasActive && notify) this.callbacks.onStopped?.(reason);
  }
}

export const liveVoice = new LiveVoice();
