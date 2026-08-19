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

    // Dedicated HTML5 Audio Player for Cloned Voice API Stream
    this.audioPlayer = new Audio();
    this.ttsApiUrl = 'https://pdt-pat-chat-charitable.trycloudflare.com/clone-tts';
    this.initAudioPlayerEvents();

    this.initWebAudio();
    this.initSpeechRecognition();
  }

  initAudioPlayerEvents() {
    this.audioPlayer.addEventListener('play', () => {
      this.isSpeaking = true;
      if (this.equalizer) this.equalizer.classList.add('active');
      this.callbacks.onUtteranceStart();
    });

    this.audioPlayer.addEventListener('ended', () => {
      this.isSpeaking = false;
      if (this.equalizer) this.equalizer.classList.remove('active');
      this.callbacks.onUtteranceEnd();
    });

    this.audioPlayer.addEventListener('error', (err) => {
      console.warn('[VoiceEngine] Audio playback error:', err);
      this.isSpeaking = false;
      if (this.equalizer) this.equalizer.classList.remove('active');
      this.callbacks.onUtteranceEnd();
    });

    this.audioPlayer.addEventListener('pause', () => {
      if (this.audioPlayer.currentTime === 0 || this.audioPlayer.ended) {
        this.isSpeaking = false;
        if (this.equalizer) this.equalizer.classList.remove('active');
      }
    });
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
  // CLONED NEURAL VOICE SYNTHESIS (Live F5-TTS)
  // ==========================================

  /**
   * Generates and streams speech from the live F5-TTS voice cloning API
   */
  async generateClonedSpeech(textToSpeak) {
    if (!textToSpeak || !this.autoSpeak) return;

    this.stopSpeaking();
    this.streamSubtitles(textToSpeak);
    this.callbacks.onUtteranceStart();
    if (this.equalizer) this.equalizer.classList.add('active');

    try {
      console.log(`[VoiceEngine] Dispatching to F5-TTS endpoint: ${this.ttsApiUrl}`);
      const response = await fetch(this.ttsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: textToSpeak,
          ref_text: "Dear Vijay, I may not be physically there, but I want you to feel my presence, my friend."
        })
      });

      if (!response.ok) {
        throw new Error(`TTS API HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawAudio = data.audio_base64 || data.audio || data.audioUrl || data.url;

      if (!rawAudio) {
        throw new Error('No audio returned in response payload');
      }

      // Format as Data URI if base64 string
      let audioSrc = rawAudio;
      if (typeof rawAudio === 'string' && !rawAudio.startsWith('data:') && !rawAudio.startsWith('http') && !rawAudio.startsWith('/')) {
        audioSrc = `data:audio/wav;base64,${rawAudio}`;
      }

      this.audioPlayer.src = audioSrc;
      await this.audioPlayer.play();
    } catch (err) {
      console.warn('[VoiceEngine] Cloned voice generation failed, falling back:', err);
      this.speakFallback(textToSpeak);
    }
  }

  /**
   * Plays dynamic audio stream directly
   */
  async playClonedSpeech(audioSource, text = '') {
    if (!audioSource || !this.autoSpeak) return;

    this.stopSpeaking();

    if (text) {
      this.streamSubtitles(text);
    }

    try {
      this.audioPlayer.src = audioSource;
      await this.audioPlayer.play();
    } catch (err) {
      console.warn('[VoiceEngine] Audio stream play error:', err);
      if (text) {
        this.speakFallback(text);
      } else {
        this.callbacks.onUtteranceEnd();
      }
    }
  }

  speak(text, audioUrl = null) {
    if (audioUrl) {
      return this.playClonedSpeech(audioUrl, text);
    }
    return this.generateClonedSpeech(text);
  }

  speakFallback(text) {
    if (!('speechSynthesis' in window) || !this.autoSpeak) return;

    this.stopSpeaking();
    window.speechSynthesis.cancel();

    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[#*_`]/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
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

    this.streamSubtitles(text);
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if (this.audioPlayer) {
      try {
        this.audioPlayer.pause();
        this.audioPlayer.currentTime = 0;
      } catch (e) {}
    }
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
