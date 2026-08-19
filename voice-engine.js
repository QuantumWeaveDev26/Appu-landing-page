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
    
    // Natural, calm speaking speed (0.88x default for crystal clear Indian language articulation)
    const savedRate = parseFloat(localStorage.getItem('appu_voice_rate')) || 0.88;
    this.rate = savedRate;
    this.selectedVoice = null;
    this.voices = [];

    // UI elements
    this.subtitlesText = document.getElementById('subtitles-text');
    this.equalizer = document.getElementById('audio-equalizer');
    this.micWrapper = document.querySelector('.voice-portal-wrapper');
    this.micTooltip = document.getElementById('mic-tooltip');

    // Dedicated HTML5 Audio Player for Cloned Voice API Stream
    this.audioPlayer = new Audio();
    this.audioPlayer.playbackRate = this.rate;
    this.audioPlayer.defaultPlaybackRate = this.rate;
    this.voiceId = '2vNb4zVImeugpHCemE1R';
    this.apiKey = 'sk_37a6d4d096ed07642eb50faeeb0d9206a121473210e5eb3e';
    this.initAudioPlayerEvents();

    this.initWebAudio();
    this.initSpeechRecognition();
  }

  initAudioPlayerEvents() {
    this.audioPlayer.addEventListener('play', () => {
      this.isSpeaking = true;
      if (this.audioPlayer) {
        this.audioPlayer.playbackRate = this.rate || 0.88;
      }
      if (this.equalizer) this.equalizer.classList.add('active');
      this.callbacks.onUtteranceStart();
    });

    this.audioPlayer.addEventListener('canplay', () => {
      if (this.audioPlayer) {
        this.audioPlayer.playbackRate = this.rate || 0.88;
      }
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

  setPlaybackRate(newRate) {
    const parsed = Math.max(0.6, Math.min(1.4, parseFloat(newRate) || 0.88));
    this.rate = parsed;
    localStorage.setItem('appu_voice_rate', String(parsed));
    if (this.audioPlayer) {
      this.audioPlayer.playbackRate = parsed;
      this.audioPlayer.defaultPlaybackRate = parsed;
    }
    console.log(`[VoiceEngine] Speaking rate set to ${parsed}x`);
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
    this.recognition.lang = 'en-IN'; // Default: Indian English / Kannada context

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

  setLanguage(langCode) {
    const langMap = {
      'en': 'en-IN',
      'kn': 'kn-IN',
      'hi': 'hi-IN',
      'te': 'te-IN',
      'ta': 'ta-IN'
    };
    this.currentLanguage = langCode || 'en';
    if (this.recognition) {
      this.recognition.lang = langMap[langCode] || 'en-IN';
    }
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
   * Generates and streams speech from ElevenLabs Turbo v2.5
   */
  async generateClonedSpeech(textToSpeak) {
    if (!textToSpeak || !this.autoSpeak) return;

    this.stopSpeaking();
    this.streamSubtitles(textToSpeak);
    this.callbacks.onUtteranceStart();
    if (this.equalizer) this.equalizer.classList.add('active');

    try {
      console.log(`[VoiceEngine] Calling ElevenLabs Turbo v2.5 for text:`, textToSpeak.slice(0, 50));
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: textToSpeak.slice(0, 800),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.8,
            speed: 0.82
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API HTTP ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      this.audioPlayer.src = audioUrl;
      this.audioPlayer.playbackRate = this.rate || 0.88;
      await this.audioPlayer.play();
    } catch (err) {
      console.warn('[VoiceEngine] ElevenLabs voice generation error:', err);
      this.callbacks.onUtteranceEnd();
      if (this.equalizer) this.equalizer.classList.remove('active');
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
      this.audioPlayer.playbackRate = this.rate || 0.88;
      await this.audioPlayer.play();
    } catch (err) {
      console.warn('[VoiceEngine] Audio stream play error:', err);
      this.callbacks.onUtteranceEnd();
      if (this.equalizer) this.equalizer.classList.remove('active');
    }
  }

  speak(text, audioData = null) {
    if (!audioData) {
      // No server-side audio bundled — generate via ElevenLabs
      return this.generateClonedSpeech(text);
    }

    // Determine if audioData is a base64 string, data URI, or URL
    let audioSrc = audioData;
    if (typeof audioData === 'string') {
      if (audioData.startsWith('data:') || audioData.startsWith('http') || audioData.startsWith('blob:')) {
        audioSrc = audioData;
      } else {
        // Raw base64 string — wrap as MP3 data URI (ElevenLabs returns MP3)
        audioSrc = `data:audio/mpeg;base64,${audioData}`;
      }
    }

    return this.playClonedSpeech(audioSrc, text);
  }

  speakFallback(text) {
    // Disabled robotic fallback voices permanently
    console.log('[VoiceEngine] Text displayed without robotic OS fallback:', text.slice(0, 50));
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
