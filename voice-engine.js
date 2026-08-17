/**
 * VoiceEngine: Speech Recognition (STT), Speech Synthesis (TTS), Subtitle Synchronization & Procedural Web Audio SFX
 */

class VoiceEngine {
  constructor(callbacks = {}) {
    this.callbacks = {
      onSpeechStart: callbacks.onSpeechStart || (() => {}),
      onSpeechResult: callbacks.onSpeechResult || (() => {}),
      onSpeechEnd: callbacks.onSpeechEnd || (() => {}),
      onSpeechError: callbacks.onSpeechError || (() => {}),
      onUtteranceStart: callbacks.onUtteranceStart || (() => {}),
      onUtteranceEnd: callbacks.onUtteranceEnd || (() => {}),
      ...callbacks
    };

    this.isListening = false;
    this.isSpeaking = false;
    this.soundEnabled = true;
    this.autoSpeak = true;
    this.pitch = 1.0;
    this.rate = 1.0;
    this.selectedVoice = null;
    this.voices = [];

    // UI elements
    this.subtitlesText = document.getElementById('subtitles-text');
    this.equalizer = document.getElementById('audio-equalizer');
    this.micWrapper = document.querySelector('.voice-portal-wrapper');
    this.micTooltip = document.getElementById('mic-tooltip');

    this.initWebAudio();
    this.initSpeechRecognition();
    this.initSpeechSynthesis();
  }

  // ==========================================
  // PROCEDURAL WEB AUDIO SFX
  // ==========================================
  initWebAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    } catch (e) {
      console.warn('Web Audio API not supported', e);
    }
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15) {
    if (!this.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

    gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + duration);
  }

  playListenStart() {
    this.playTone(520, 'sine', 0.1, 0.12);
    setTimeout(() => this.playTone(880, 'sine', 0.2, 0.15), 80);
  }

  playListenStop() {
    this.playTone(660, 'sine', 0.1, 0.1);
    setTimeout(() => this.playTone(440, 'sine', 0.18, 0.12), 70);
  }

  playMessage() {
    this.playTone(587.33, 'triangle', 0.15, 0.1);
    setTimeout(() => this.playTone(880, 'sine', 0.25, 0.12), 60);
  }

  playSuccess() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 'sine', 0.35, 0.15), i * 90);
    });
  }

  // ==========================================
  // SPEECH RECOGNITION (STT)
  // ==========================================
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-IN'; // Indian English / Kannada context

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateMicUI(true);
      this.playListenStart();
      this.callbacks.onSpeechStart();
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const activeText = finalTranscript || interimTranscript;
      if (activeText && this.subtitlesText) {
        this.subtitlesText.textContent = `"${activeText}"`;
      }

      if (finalTranscript) {
        this.callbacks.onSpeechResult(finalTranscript.trim());
      }
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.stopListening();
      this.callbacks.onSpeechError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateMicUI(false);
      this.playListenStop();
      this.callbacks.onSpeechEnd();
    };
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }

  startListening() {
    if (this.isSpeaking) {
      this.stopSpeaking();
    }
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (err) {
        console.warn('Recognition start exception:', err);
      }
    } else {
      alert('Speech Recognition is not supported on this browser. Please use Chrome, Edge, or type in the chat!');
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('Recognition stop exception:', err);
      }
    }
    this.isListening = false;
    this.updateMicUI(false);
  }

  updateMicUI(listening) {
    if (!this.micWrapper) return;
    if (listening) {
      this.micWrapper.classList.add('is-listening');
      if (this.micTooltip) this.micTooltip.textContent = 'Listening...';
    } else {
      this.micWrapper.classList.remove('is-listening');
      if (this.micTooltip) this.micTooltip.textContent = 'Tap to Talk';
    }
  }

  // ==========================================
  // SPEECH SYNTHESIS (TTS)
  // ==========================================
  initSpeechSynthesis() {
    if (!('speechSynthesis' in window)) {
      console.warn('SpeechSynthesis not supported.');
      return;
    }

    const loadVoices = () => {
      this.voices = window.speechSynthesis.getVoices();
      this.populateVoiceSelect();
      this.selectBestVoice();
    };

    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  selectBestVoice() {
    if (!this.voices || this.voices.length === 0) return;

    // Prioritize natural Indian English, Kannada or warm male voice
    const preferred = this.voices.find(v => 
      v.lang.includes('en-IN') || 
      v.lang.includes('kn') || 
      v.name.toLowerCase().includes('india') ||
      v.name.toLowerCase().includes('ravi') ||
      v.name.toLowerCase().includes('heera') ||
      v.name.toLowerCase().includes('male')
    );

    this.selectedVoice = preferred || this.voices[0];
  }

  populateVoiceSelect() {
    const select = document.getElementById('setting-voice-select');
    if (!select) return;

    select.innerHTML = '';
    this.voices.forEach((v, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${v.name} (${v.lang})${v.default ? ' [Default]' : ''}`;
      if (this.selectedVoice && v.name === this.selectedVoice.name) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  speak(text) {
    if (!('speechSynthesis' in window) || !this.autoSpeak) return;

    this.stopSpeaking();
    window.speechSynthesis.cancel();

    // Clean text for speech (strip markdown links, emojis)
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_`]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.pitch = this.pitch;
    utterance.rate = this.rate;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.equalizer) this.equalizer.classList.add('active');
      this.callbacks.onUtteranceStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.equalizer) this.equalizer.classList.remove('active');
      this.callbacks.onUtteranceEnd();
    };

    utterance.onerror = (e) => {
      console.warn('Speech synthesis error:', e);
      this.isSpeaking = false;
      if (this.equalizer) this.equalizer.classList.remove('active');
      this.callbacks.onUtteranceEnd();
    };

    // Subtitle typewriter effect
    this.streamSubtitles(text);

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    if (this.equalizer) this.equalizer.classList.remove('active');
  }

  streamSubtitles(fullText) {
    if (!this.subtitlesText) return;
    this.subtitlesText.textContent = '';

    let i = 0;
    const speed = Math.max(15, Math.min(45, 1200 / fullText.length));

    const typeInterval = setInterval(() => {
      if (i < fullText.length) {
        this.subtitlesText.textContent += fullText.charAt(i);
        i++;
      } else {
        clearInterval(typeInterval);
      }
    }, speed);
  }
}

window.VoiceEngine = VoiceEngine;
