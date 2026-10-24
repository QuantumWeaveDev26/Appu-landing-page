/**
 * APPU Mascot Avatar v1.0
 * Code-drawn animated SVG mascot with reactive 5-mood state machine:
 * - idle: gentle floating hover + periodic eye blink
 * - listening: tilted attention + soundwave rings (mic on)
 * - thinking: thoughtful expression + orbital glowing dots (awaiting reply)
 * - explaining: animated speech/gesture + rhythmic bob (streaming card)
 * - celebrating: energetic bounce + sparkling starbursts (correct check)
 *
 * Designed to brand cyan (#22d3ee, #0ea5c4) and gold (#fbbf24, #f59e0b).
 * Pure SVG + CSS keyframes, zero heavy external libraries, respects prefers-reduced-motion.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.MascotAvatar = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MOODS = ['idle', 'listening', 'thinking', 'explaining', 'celebrating'];

  // Terminal face ASCII symbols per mood
  const FACE_EXPRESSIONS = {
    idle: { left: '>', right: '=', mouth: '' },
    listening: { left: '>', right: 'o', mouth: ')' },
    thinking: { left: '>', right: '~', mouth: '?' },
    explaining: { left: '>', right: '▽', mouth: '' },
    celebrating: { left: '^', right: '^', mouth: '★' }
  };

  class MascotAvatar {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      this.mood = 'idle';
      this.moodTimer = null;
      this.options = Object.assign({
        initialMood: 'idle',
        size: 72,
        onMoodChange: null
      }, options);

      if (this.container) {
        this.render();
        this.setMood(this.options.initialMood || 'idle');
      }
    }

    /**
     * Builds and injects the Mascot SVG structure into the container.
     */
    render() {
      if (!this.container) return;
      this.container.classList.add('appu-mascot-host');
      this.container.innerHTML = `
        <div class="appu-mascot-wrapper mood-idle" role="img" aria-label="APPU AI Mascot">
          <svg class="appu-mascot-svg" viewBox="0 0 120 120" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="appu-body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="50%" stop-color="#0ea5c4" />
                <stop offset="100%" stop-color="#0369a1" />
              </linearGradient>
              <linearGradient id="appu-screen-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#05162a" />
                <stop offset="100%" stop-color="#020a14" />
              </linearGradient>
              <linearGradient id="appu-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#fde047" />
                <stop offset="100%" stop-color="#f59e0b" />
              </linearGradient>
              <filter id="appu-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Mascot Shadow -->
            <ellipse class="mascot-shadow" cx="60" cy="112" rx="28" ry="5" fill="rgba(0, 0, 0, 0.35)" />

            <!-- Floater Group -->
            <g class="mascot-floater">
              <!-- Audio Rings (Visible in 'listening' mood) -->
              <g class="mascot-audio-waves" opacity="0">
                <circle cx="20" cy="45" r="10" fill="none" stroke="#22d3ee" stroke-width="2" class="wave-ring ring-1" />
                <circle cx="20" cy="45" r="16" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="2 3" class="wave-ring ring-2" />
                <circle cx="100" cy="45" r="10" fill="none" stroke="#22d3ee" stroke-width="2" class="wave-ring ring-1" />
                <circle cx="100" cy="45" r="16" fill="none" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="2 3" class="wave-ring ring-2" />
              </g>

              <!-- Sparkles (Visible in 'celebrating' mood) -->
              <g class="mascot-sparkles" opacity="0">
                <path d="M 16 28 Q 20 28 20 24 Q 20 28 24 28 Q 20 28 20 32 Q 20 28 16 28 Z" fill="#ffd65c" class="sparkle sp-1" />
                <path d="M 98 22 Q 102 22 102 18 Q 102 22 106 22 Q 102 22 102 26 Q 102 22 98 22 Z" fill="#22d3ee" class="sparkle sp-2" />
                <circle cx="26" cy="16" r="2.5" fill="#fde047" class="sparkle-dot dot-1" />
                <circle cx="94" cy="38" r="2" fill="#38bdf8" class="sparkle-dot dot-2" />
              </g>

              <!-- Antenna -->
              <line x1="60" y1="30" x2="60" y2="15" stroke="#0ea5c4" stroke-width="3.5" stroke-linecap="round" />
              <circle class="mascot-antenna-tip" cx="60" cy="14" r="5" fill="url(#appu-gold-grad)" filter="url(#appu-glow)" />

              <!-- Fluffy Robot Body/Head -->
              <rect class="mascot-body" x="24" y="28" width="72" height="66" rx="28" fill="url(#appu-body-grad)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="1.5" />

              <!-- Left & Right Ear Nubs -->
              <rect x="18" y="50" width="7" height="16" rx="3.5" fill="#0284c7" />
              <rect x="95" y="50" width="7" height="16" rx="3.5" fill="#0284c7" />

              <!-- Terminal Face Screen -->
              <rect class="mascot-screen" x="32" y="38" width="56" height="42" rx="14" fill="url(#appu-screen-grad)" stroke="rgba(34, 211, 238, 0.45)" stroke-width="1.5" />
              <rect class="mascot-screen-glare" x="35" y="40" width="50" height="14" rx="7" fill="rgba(255, 255, 255, 0.07)" />

              <!-- Face Expression (Terminal Phosphors) -->
              <g class="mascot-face" filter="url(#appu-glow)">
                <text class="face-eye-left" x="43" y="66" fill="#22d3ee" font-family="'Space Grotesk', monospace" font-size="20" font-weight="900" text-anchor="middle">&gt;</text>
                <text class="face-eye-right" x="63" y="66" fill="#22d3ee" font-family="'Space Grotesk', monospace" font-size="20" font-weight="900" text-anchor="middle">=</text>
                <text class="face-extra" x="78" y="66" fill="#ffd65c" font-family="'Space Grotesk', monospace" font-size="14" font-weight="900" text-anchor="middle"></text>
              </g>

              <!-- Little Floating Arms -->
              <g class="mascot-arms">
                <ellipse class="mascot-arm arm-left" cx="20" cy="74" rx="5" ry="9" fill="#0284c7" transform="rotate(-15 20 74)" />
                <ellipse class="mascot-arm arm-right" cx="100" cy="74" rx="5" ry="9" fill="#0284c7" transform="rotate(15 100 74)" />
              </g>

              <!-- Thinking Orbiting Dots -->
              <g class="mascot-thinking-dots" opacity="0">
                <circle cx="60" cy="24" r="3" fill="#22d3ee" class="think-dot td-1" />
                <circle cx="72" cy="26" r="2.5" fill="#fde047" class="think-dot td-2" />
                <circle cx="82" cy="32" r="2" fill="#38bdf8" class="think-dot td-3" />
              </g>
            </g>
          </svg>
        </div>
      `;

      this.wrapper = this.container.querySelector('.appu-mascot-wrapper');
      this.eyeLeft = this.container.querySelector('.face-eye-left');
      this.eyeRight = this.container.querySelector('.face-eye-right');
      this.faceExtra = this.container.querySelector('.face-extra');
    }

    /**
     * Updates mascot state to one of the 5 canonical moods.
     * @param {string} mood - 'idle' | 'listening' | 'thinking' | 'explaining' | 'celebrating'
     * @param {number} [durationMs] - Optional auto-revert timer back to 'idle'
     */
    setMood(mood, durationMs) {
      if (this.moodTimer) {
        clearTimeout(this.moodTimer);
        this.moodTimer = null;
      }

      const validMood = MOODS.includes(mood) ? mood : 'idle';
      this.mood = validMood;

      if (this.wrapper) {
        MOODS.forEach(m => this.wrapper.classList.remove(`mood-${m}`));
        this.wrapper.classList.add(`mood-${validMood}`);
        this.wrapper.setAttribute('data-mood', validMood);
      }

      // Update terminal face ASCII expression
      const expr = FACE_EXPRESSIONS[validMood] || FACE_EXPRESSIONS.idle;
      if (this.eyeLeft) this.eyeLeft.textContent = expr.left;
      if (this.eyeRight) this.eyeRight.textContent = expr.right;
      if (this.faceExtra) this.faceExtra.textContent = expr.mouth;

      if (typeof this.options.onMoodChange === 'function') {
        this.options.onMoodChange(validMood);
      }

      if (typeof durationMs === 'number' && durationMs > 0) {
        this.moodTimer = setTimeout(() => {
          this.setMood('idle');
        }, durationMs);
      }

      return this;
    }

    idle() { return this.setMood('idle'); }
    listen() { return this.setMood('listening'); }
    think() { return this.setMood('thinking'); }
    explain() { return this.setMood('explaining'); }
    celebrate(durationMs = 3200) { return this.setMood('celebrating', durationMs); }

    getMood() {
      return this.mood;
    }

    destroy() {
      if (this.moodTimer) clearTimeout(this.moodTimer);
      if (this.container) this.container.innerHTML = '';
    }
  }

  MascotAvatar.MOODS = MOODS;
  MascotAvatar.FACE_EXPRESSIONS = FACE_EXPRESSIONS;

  return MascotAvatar;
});
