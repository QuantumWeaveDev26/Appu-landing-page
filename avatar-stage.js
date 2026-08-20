/**
 * AvatarStage v3.0: State Choreography & Ambient Cursor Engine
 * Controls Appu's visual states (idle, listening, thinking, speaking, success)
 * and ambient desktop cursor interactions.
 */

class AvatarStage {
  constructor() {
    this.wrapper = document.getElementById('avatar-3d-wrapper');
    this.halo = document.getElementById('stage-halo') || document.getElementById('appu-halo');
    this.avatarFigure = document.getElementById('avatar-figure-container');
    this.statusPill = document.getElementById('avatar-status-pill');
    this.statusLabel = document.getElementById('status-label');
    this.voicePortal = document.getElementById('voice-portal');

    // Custom Cursor Elements
    this.cursorDot = document.getElementById('cursor-dot');
    this.cursorAura = document.getElementById('cursor-aura');
    this.cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.auraPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // State
    this.currentState = 'idle';

    this.initEventListeners();
    if (!this.isTouchDevice) {
      this.animateCursor();
    } else {
      if (this.cursorDot) this.cursorDot.style.display = 'none';
      if (this.cursorAura) this.cursorAura.style.display = 'none';
    }
  }

  initEventListeners() {
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
    requestAnimationFrame(() => this.animateCursor());
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    // Update wrapper & halo state classes
    if (this.wrapper) {
      this.wrapper.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
      this.wrapper.classList.add(`state-${state}`);
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
      idle: 'Appu is Online',
      listening: 'Appu is Listening...',
      thinking: 'Appu is Thinking...',
      speaking: 'Appu is Speaking...',
      success: 'Discovery Call Booked!'
    };

    if (this.statusLabel) {
      this.statusLabel.textContent = labels[state] || 'Appu is Online';
    }
  }
}

window.AvatarStage = AvatarStage;
