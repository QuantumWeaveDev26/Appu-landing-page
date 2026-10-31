/**
 * AvatarStage v3.5: State Choreography, Build-Light "Talking Appu", & Ambient Cursor Engine
 * - Controls Appu's visual states (idle, listening, thinking, speaking, success)
 * - Real-time audio-synced speaking animation (mouth aperture, organic head bob, natural blinks)
 * - Clean architecture: modular adapter for future streaming avatar pilots (HeyGen/D-ID)
 * - Respects prefers-reduced-motion, ultra-performant, zero heavy 3D libraries
 */

class AvatarStage {
  constructor(options = {}) {
    this.wrapper = document.getElementById('avatar-3d-wrapper');
    this.halo = document.getElementById('stage-halo') || document.getElementById('appu-halo');
    this.avatarFigure = document.getElementById('avatar-figure-container');
    this.statusPill = document.getElementById('avatar-status-pill');
    this.statusLabel = document.getElementById('status-label');
    this.voicePortal = document.getElementById('voice-portal');

    // Voice Engine Reference
    this.voiceEngine = options.voiceEngine || null;

    // Custom Cursor Elements
    this.cursorDot = document.getElementById('cursor-dot');
    this.cursorAura = document.getElementById('cursor-aura');
    this.cursorPos = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 };
    this.auraPos = { x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 };
    this.isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));

    // Talking Avatar Elements & Animation State
    this.modelFrame = null;
    this.heroAppuImg = null;
    this.mouthWrap = null;
    this.mouthEl = null;
    this.eyeLeft = null;
    this.eyeRight = null;

    this._animatingSpeech = false;
    this._speechFrame = 0;
    this._smoothAmplitude = 0;
    this._speechRaf = null;
    this._lastBlinkTime = Date.now();
    this._nextBlinkDelay = 3500 + Math.random() * 2000;
    this._idleBlinkTimer = null;

    // Modular avatar provider interface (allows plugging in HeyGen/D-ID streaming pilots later)
    this.avatarProvider = null;

    // Current State
    this.currentState = 'idle';

    this.initTalkingAvatarDOM();
    this.initEventListeners();
    this.startIdleBlinks();

    if (!this.isTouchDevice && typeof window !== 'undefined') {
      this.animateCursor();
    } else {
      if (this.cursorDot) this.cursorDot.style.display = 'none';
      if (this.cursorAura) this.cursorAura.style.display = 'none';
    }
  }

  setVoiceEngine(voiceEngine) {
    this.voiceEngine = voiceEngine;
  }

  /**
   * Modular adapter hook: plugs in streaming WebRTC avatar engines (HeyGen / D-ID / Simli)
   * without blocking or refactoring the rest of the application.
   */
  setAvatarProvider(provider) {
    if (this.avatarProvider && typeof this.avatarProvider.destroy === 'function') {
      try { this.avatarProvider.destroy(); } catch (_) {}
    }
    this.avatarProvider = provider;
    if (provider && typeof provider.init === 'function') {
      provider.init({ stage: this, wrapper: this.wrapper, figure: this.avatarFigure });
    }
  }

  initTalkingAvatarDOM() {
    if (typeof document === 'undefined') return;

    this.modelFrame = document.getElementById('avatar-model-frame');
    this.heroAppuImg = document.getElementById('hero-appu-img');
    this.mouthWrap = document.getElementById('avatar-mouth-wrap');
    this.mouthEl = document.getElementById('avatar-mouth');
    this.eyeLeft = document.getElementById('avatar-eye-left');
    this.eyeRight = document.getElementById('avatar-eye-right');

    if (this.mouthWrap && this.modelFrame) return;

    if (!this.avatarFigure) {
      this.avatarFigure = document.getElementById('avatar-figure-container');
    }
    if (!this.avatarFigure) return;

    const img = this.avatarFigure.querySelector('.hero-appu-photo') || this.heroAppuImg;
    let frame = this.avatarFigure.querySelector('.avatar-model-frame') || this.modelFrame;

    if (!frame && img && img.parentNode) {
      frame = document.createElement('div');
      frame.className = 'avatar-model-frame';
      frame.id = 'avatar-model-frame';
      img.parentNode.insertBefore(frame, img);
      frame.appendChild(img);
      this.modelFrame = frame;
    }

    if (frame && !frame.querySelector('.avatar-face-mesh')) {
      const mesh = document.createElement('div');
      mesh.className = 'avatar-face-mesh';
      mesh.id = 'avatar-face-mesh';
      mesh.setAttribute('aria-hidden', 'true');
      mesh.innerHTML = `
        <div class="avatar-eye-blink eye-left" id="avatar-eye-left"></div>
        <div class="avatar-eye-blink eye-right" id="avatar-eye-right"></div>
        <div class="avatar-mouth-wrap" id="avatar-mouth-wrap">
          <div class="avatar-mouth" id="avatar-mouth"></div>
        </div>
      `;
      frame.appendChild(mesh);
    }

    this.modelFrame = document.getElementById('avatar-model-frame') || frame;
    this.heroAppuImg = document.getElementById('hero-appu-img') || img;
    this.mouthWrap = document.getElementById('avatar-mouth-wrap');
    this.mouthEl = document.getElementById('avatar-mouth');
    this.eyeLeft = document.getElementById('avatar-eye-left');
    this.eyeRight = document.getElementById('avatar-eye-right');
  }

  initEventListeners() {
    if (typeof window === 'undefined') return;

    // Custom Cursor Follower on Non-Touch Devices
    if (!this.isTouchDevice) {
      window.addEventListener('mousemove', (e) => {
        this.cursorPos.x = e.clientX;
        this.cursorPos.y = e.clientY;

        if (this.cursorDot) {
          this.cursorDot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
        }
      });

      // Hover feedback
      const interactiveEls = document.querySelectorAll('button, a, input, select, textarea, .avatar-interactive-figure, .chip-action-btn, .lang-btn, .feature-pillar-card, .track-luxury-card, .faq-item');
      interactiveEls.forEach((el) => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
      });
    }
  }

  animateCursor() {
    if (this.cursorAura) {
      this.auraPos.x += (this.cursorPos.x - this.auraPos.x) * 0.15;
      this.auraPos.y += (this.cursorPos.y - this.auraPos.y) * 0.15;
      this.cursorAura.style.transform = `translate(${this.auraPos.x}px, ${this.auraPos.y}px) translate(-50%, -50%)`;
    }
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => this.animateCursor());
    }
  }

  /**
   * Blinks Appu's eyes naturally for 140ms.
   */
  triggerBlink() {
    if (this.eyeLeft) this.eyeLeft.classList.add('is-blinking');
    if (this.eyeRight) this.eyeRight.classList.add('is-blinking');
    setTimeout(() => {
      if (this.eyeLeft) this.eyeLeft.classList.remove('is-blinking');
      if (this.eyeRight) this.eyeRight.classList.remove('is-blinking');
    }, 140);
  }

  startIdleBlinks() {
    if (typeof window === 'undefined') return;
    const scheduleNext = () => {
      const delay = 3500 + Math.random() * 3000;
      this._idleBlinkTimer = setTimeout(() => {
        if (this.currentState !== 'speaking') {
          this.triggerBlink();
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  /**
   * Lightweight audio-reactive speech animation loop.
   * Samples TTS audio amplitude via Web Audio AnalyserNode (or rhythmic fallback)
   * and drives mouth aperture, subtle head/body bobbing, and natural blinks.
   */
  startSpeechAnimation() {
    if (this._animatingSpeech) return;
    this._animatingSpeech = true;
    this._speechFrame = 0;
    this._smoothAmplitude = 0;
    this._lastBlinkTime = Date.now();
    this._nextBlinkDelay = 2500 + Math.random() * 2000;

    const animate = () => {
      if (!this._animatingSpeech || this.currentState !== 'speaking') {
        this.resetAvatarToRest();
        return;
      }

      // Read real-time speech amplitude
      let rawAmp = 0;
      const ve = (typeof window !== 'undefined' && window.app && window.app.voiceEngine) || this.voiceEngine;
      if (ve && typeof ve.getSpeechAmplitude === 'function') {
        rawAmp = ve.getSpeechAmplitude();
      } else {
        const t = Date.now() / 1000;
        rawAmp = Math.sin(t * 14) * 0.35 + Math.sin(t * 22) * 0.25 + 0.35;
      }

      // If voice engine reports near-zero amplitude while speech state is active
      // (e.g. SpeechSynthesis active, initial stream buffering, or silent pause),
      // drive the mouth with a natural harmonic syllable envelope so Appu articulates visibly
      const isSpeakingState = (this.currentState === 'speaking') ||
        Boolean(ve && ve.isSpeaking) ||
        (typeof window !== 'undefined' && Boolean(window.speechSynthesis && window.speechSynthesis.speaking));

      if (rawAmp < 0.08 && isSpeakingState) {
        const t = Date.now() / 1000;
        rawAmp = Math.max(0.18, Math.sin(t * 13) * 0.32 + Math.sin(t * 21) * 0.22 + 0.38);
      }

      // Smooth damping (low-pass filter for organic fluid motion)
      this._smoothAmplitude += (rawAmp - this._smoothAmplitude) * 0.42;
      const amp = Math.max(0, Math.min(1, this._smoothAmplitude));

      const prefersReducedMotion = typeof window !== 'undefined' &&
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. Mouth Aperture: Proportional to audio amplitude
      this.updateMouth(amp);

      // 2. Subtle Head / Body Bobbing: Harmonic vertical bob and gentle tilt
      if (!prefersReducedMotion) {
        this.updateHeadBob(amp);
      }

      // 3. Occasional Natural Eye Blinks during speech
      const now = Date.now();
      if (now - this._lastBlinkTime > this._nextBlinkDelay) {
        this.triggerBlink();
        this._lastBlinkTime = now;
        this._nextBlinkDelay = 3000 + Math.random() * 2500;
      }

      if (typeof requestAnimationFrame === 'function') {
        this._speechRaf = requestAnimationFrame(animate);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      this._speechRaf = requestAnimationFrame(animate);
    }
  }

  updateMouth(amp) {
    if (!this.mouthWrap) return;
    if (amp < 0.05) {
      this.mouthWrap.style.transform = 'translate(-50%, -50%) scaleY(0)';
      this.mouthWrap.style.opacity = '0';
      return;
    }

    // Subtle, organic aperture shadow — never a hard colored block
    const scaleY = Math.min(0.9, Math.max(0.15, amp * 0.75));
    const scaleX = Math.min(1.05, Math.max(0.88, 0.92 + amp * 0.12));
    this.mouthWrap.style.transform = `translate(-50%, -50%) scale(${scaleX.toFixed(2)}, ${scaleY.toFixed(2)})`;
    this.mouthWrap.style.opacity = Math.min(0.65, Math.max(0.2, amp * 0.65)).toFixed(2);
  }

  updateHeadBob(amp) {
    const target = this.modelFrame || this.heroAppuImg;
    if (!target) return;
    this._speechFrame += 1;

    const bobY = Math.sin(this._speechFrame * 0.12) * 3.5 * amp;
    const tiltDeg = Math.cos(this._speechFrame * 0.08) * 0.8 * amp;

    target.style.transform = `translate3d(0, ${(-bobY).toFixed(2)}px, 0) rotate(${tiltDeg.toFixed(2)}deg)`;
  }

  resetAvatarToRest() {
    this._animatingSpeech = false;
    if (this._speechRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._speechRaf);
      this._speechRaf = null;
    }
    this._smoothAmplitude = 0;

    if (this.mouthWrap) {
      this.mouthWrap.style.transform = 'translate(-50%, -50%) scaleY(0)';
      this.mouthWrap.style.opacity = '0';
    }
    const target = this.modelFrame || this.heroAppuImg;
    if (target) {
      target.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
    }
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    // Delegate to modular provider if active
    if (this.avatarProvider && typeof this.avatarProvider.onStateChange === 'function') {
      this.avatarProvider.onStateChange(state);
    }

    // Update wrapper & halo state classes
    if (this.wrapper) {
      this.wrapper.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
      this.wrapper.classList.add(`state-${state}`);

      const moodMap = {
        idle: 'mood-idle',
        listening: 'mood-listening',
        thinking: 'mood-thinking',
        speaking: 'mood-explaining',
        success: 'mood-celebrating'
      };
      this.wrapper.classList.remove('mood-idle', 'mood-listening', 'mood-thinking', 'mood-explaining', 'mood-celebrating');
      if (moodMap[state]) {
        this.wrapper.classList.add(moodMap[state]);
      }
    }
    if (this.halo) {
      this.halo.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
      this.halo.classList.add(`state-${state}`);
    }

    // Update voice portal pulse
    if (this.voicePortal) {
      if (state === 'listening') {
        this.voicePortal.classList.add('is-listening');
      } else {
        this.voicePortal.classList.remove('is-listening');
      }
    }

    // Update status pill
    if (this.statusPill) {
      this.statusPill.classList.remove('idle', 'listening', 'thinking', 'speaking', 'success');
      this.statusPill.classList.add(state);
    }

    const labels = {
      idle: 'Appu is ready',
      listening: 'Listening — tell me your topic',
      thinking: 'Working it out…',
      speaking: 'Appu is explaining…',
      success: 'Parent call booked!'
    };

    if (this.statusLabel) {
      this.statusLabel.textContent = labels[state] || 'Appu is ready';
    }

    // Trigger or halt speech animation
    if (state === 'speaking') {
      this.startSpeechAnimation();
    } else {
      this.resetAvatarToRest();
    }
  }
}

if (typeof window !== 'undefined') {
  window.AvatarStage = AvatarStage;
}
if (typeof module === 'object' && module.exports) {
  module.exports = AvatarStage;
}
