/**
 * VoiceCall: hands-free "call" screen on top of VoiceEngine's live session (character.ai style).
 *
 * - Opens when a call starts (the phone button, VoiceEngine.startCall) and closes when it ends.
 *   The mic buttons use the same always-on listening without this screen (VoiceEngine.toggleMic).
 * - Shows what Appu is doing: listening, thinking or speaking, plus the words heard so far.
 * - Barge-in lives in VoiceEngine: the mic stays open while Appu speaks, and words Appu is not
 *   saying itself stop the answer. Tapping the orb also interrupts.
 */
(function (root) {
  'use strict';

  function createCall(engine, doc, hooks = {}) {
    let overlay = null;
    let stateLabel = null;
    let heardLine = null;
    let pollTimer = null;
    let lastState = '';
    let startedAt = 0;

    function t(text) {
      const i18n = root.AppuI18n;
      return i18n && typeof i18n.translate === 'function' ? i18n.translate(text, i18n.language) : text;
    }

    function build() {
      overlay = doc.createElement('div');
      overlay.id = 'voice-call';
      overlay.className = 'voice-call';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Voice call with Appu');
      overlay.innerHTML = `
        <div class="voice-call-inner">
          <p class="voice-call-title">Voice call with Appu</p>
          <button type="button" class="voice-call-orb" aria-label="Tap to interrupt Appu">
            <span class="voice-call-ring" aria-hidden="true"></span>
            <span class="voice-call-ring" aria-hidden="true"></span>
            <i class="fa-solid fa-microphone" aria-hidden="true"></i>
          </button>
          <p class="voice-call-state" aria-live="polite"></p>
          <p class="voice-call-heard" data-no-translate></p>
          <p class="voice-call-hint">Tap Appu or just talk to interrupt</p>
          <button type="button" class="voice-call-end"><i class="fa-solid fa-phone-slash" aria-hidden="true"></i><span>End call</span></button>
        </div>`;
      stateLabel = overlay.querySelector('.voice-call-state');
      heardLine = overlay.querySelector('.voice-call-heard');
      overlay.querySelector('.voice-call-end').addEventListener('click', () => engine.stopLiveSession());
      overlay.querySelector('.voice-call-orb').addEventListener('click', () => {
        if (engine.isSpeaking) interrupt();
        else if (!engine.isListening && !engine.awaitingResponse) engine.startListening();
      });
      doc.body.appendChild(overlay);
    }

    function currentState() {
      if (engine.isSpeaking) return 'speaking';
      if (engine.awaitingResponse) return 'thinking';
      return 'listening'; // the mic is always on during a call
    }

    const LABELS = {
      listening: 'Listening…',
      thinking: 'Thinking…',
      speaking: 'Appu is speaking'
    };

    function render() {
      if (!overlay) return;
      const state = currentState();
      if (state !== lastState) {
        overlay.dataset.state = state;
        stateLabel.textContent = t(LABELS[state]);
        if (state === 'listening' && lastState === 'speaking') heardLine.textContent = '';
        lastState = state;
      }
    }

    function interrupt() {
      if (typeof engine.interrupt === 'function') engine.interrupt();
      render();
    }

    function open() {
      if (overlay) return;
      build();
      startedAt = Date.now();
      if (typeof hooks.onCallStart === 'function') hooks.onCallStart();
      lastState = '';
      doc.body.classList.add('voice-call-open');
      render();
      pollTimer = root.setInterval(render, 100);
    }

    function close() {
      if (!overlay) return;
      root.clearInterval(pollTimer);
      pollTimer = null;
      overlay.remove();
      overlay = null;
      doc.body.classList.remove('voice-call-open');
      if (typeof hooks.onCallEnd === 'function') hooks.onCallEnd({ seconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000)) });
    }

    function showHeard(text) {
      if (heardLine && text) heardLine.textContent = `“${text}”`;
    }

    return { open, close, render, showHeard, interrupt, get isOpen() { return Boolean(overlay); } };
  }

  /** Hooks the call screen onto a VoiceEngine instance. */
  function attach(engine, doc = root.document, hooks = {}) {
    if (!engine || engine.__voiceCall) return engine && engine.__voiceCall;
    const call = createCall(engine, doc, hooks);
    engine.__voiceCall = call;

    const start = engine.startLiveSession.bind(engine);
    engine.startLiveSession = function (mode) {
      start(mode);
      if (engine.liveSessionActive && engine.liveMode === 'call') call.open();
    };
    const stop = engine.stopLiveSession.bind(engine);
    engine.stopLiveSession = function () {
      stop();
      call.close();
    };
    const interim = engine.onInterimTranscript;
    engine.onInterimTranscript = function (text) {
      call.showHeard(text);
      if (typeof interim === 'function') interim.call(engine, text);
    };
    const final = engine.onTranscript;
    engine.onTranscript = function (text) {
      call.showHeard(text);
      if (typeof final === 'function') return final.call(engine, text);
      return undefined;
    };
    return call;
  }

  const VoiceCall = { attach };
  root.VoiceCall = VoiceCall;
  if (typeof module !== 'undefined' && module.exports) module.exports = VoiceCall;
})(typeof window !== 'undefined' ? window : globalThis);
