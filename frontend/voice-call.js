/**
 * VoiceCall: hands-free "call" screen on top of VoiceEngine's live session (character.ai style).
 *
 * - Opens whenever a live voice session starts (any mic button) and closes when it ends.
 * - Shows what Appu is doing: listening, thinking or speaking, plus the words heard so far.
 * - Barge-in: while Appu speaks, talking (or tapping Appu) stops the answer and Appu listens again.
 *   The mic level is read with echo cancellation on, and only a sustained, loud voice counts,
 *   so Appu's own audio from the speaker does not interrupt itself.
 * - Answers already stream as audio and Appu listens again after each answer (VoiceEngine).
 */
(function (root) {
  'use strict';

  const BARGE_IN_RMS = 0.075;     // voice level that counts as the learner talking
  const BARGE_IN_HOLD_MS = 320;   // it must last this long (ignores clicks, coughs, speaker bleed)
  const BARGE_IN_GRACE_MS = 700;  // ignore the first moments of Appu's answer

  function createCall(engine, doc) {
    let overlay = null;
    let stateLabel = null;
    let heardLine = null;
    let pollTimer = null;
    let micStream = null;
    let audioCtx = null;
    let analyser = null;
    let loudSince = 0;
    let speakingSince = 0;
    let lastState = '';

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
      if (engine.isListening) return 'listening';
      return 'waiting';
    }

    const LABELS = {
      listening: 'Listening…',
      thinking: 'Thinking…',
      speaking: 'Appu is speaking',
      waiting: 'Getting ready…'
    };

    function render() {
      if (!overlay) return;
      const state = currentState();
      if (state !== lastState) {
        overlay.dataset.state = state;
        stateLabel.textContent = t(LABELS[state]);
        if (state === 'speaking') speakingSince = Date.now();
        if (state === 'listening') heardLine.textContent = '';
        lastState = state;
      }
      if (state === 'speaking') checkBargeIn();
      else loudSince = 0;
    }

    function interrupt() {
      loudSince = 0;
      if (typeof engine.interrupt === 'function') engine.interrupt();
      render();
    }

    function micLevel() {
      if (!analyser) return 0;
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
      return Math.sqrt(sum / data.length);
    }

    function checkBargeIn() {
      if (!analyser || Date.now() - speakingSince < BARGE_IN_GRACE_MS) return;
      if (micLevel() >= BARGE_IN_RMS) {
        if (!loudSince) loudSince = Date.now();
        else if (Date.now() - loudSince >= BARGE_IN_HOLD_MS) interrupt();
      } else {
        loudSince = 0;
      }
    }

    async function startMicMonitor() {
      const nav = root.navigator;
      const Ctx = root.AudioContext || root.webkitAudioContext;
      if (!nav || !nav.mediaDevices || !nav.mediaDevices.getUserMedia || !Ctx) return;
      try {
        micStream = await nav.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        if (!overlay) { stopMicMonitor(); return; }
        audioCtx = new Ctx();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        audioCtx.createMediaStreamSource(micStream).connect(analyser);
      } catch (_) {
        // No mic level available: tapping Appu still interrupts.
        stopMicMonitor();
      }
    }

    function stopMicMonitor() {
      if (micStream) micStream.getTracks().forEach((track) => track.stop());
      if (audioCtx) { try { audioCtx.close(); } catch (_) {} }
      micStream = null;
      audioCtx = null;
      analyser = null;
    }

    function open() {
      if (overlay) return;
      build();
      lastState = '';
      doc.body.classList.add('voice-call-open');
      render();
      pollTimer = root.setInterval(render, 100);
      startMicMonitor();
    }

    function close() {
      if (!overlay) return;
      root.clearInterval(pollTimer);
      pollTimer = null;
      stopMicMonitor();
      overlay.remove();
      overlay = null;
      doc.body.classList.remove('voice-call-open');
    }

    function showHeard(text) {
      if (heardLine && text) heardLine.textContent = `“${text}”`;
    }

    return { open, close, render, showHeard, interrupt, get isOpen() { return Boolean(overlay); } };
  }

  /** Hooks the call screen onto a VoiceEngine instance. */
  function attach(engine, doc = root.document) {
    if (!engine || engine.__voiceCall) return engine && engine.__voiceCall;
    const call = createCall(engine, doc);
    engine.__voiceCall = call;

    const start = engine.startLiveSession.bind(engine);
    engine.startLiveSession = function () {
      start();
      if (engine.liveSessionActive) call.open();
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

  const VoiceCall = { attach, BARGE_IN_RMS, BARGE_IN_HOLD_MS };
  root.VoiceCall = VoiceCall;
  if (typeof module !== 'undefined' && module.exports) module.exports = VoiceCall;
})(typeof window !== 'undefined' ? window : globalThis);
