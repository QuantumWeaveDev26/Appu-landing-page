/**
 * AvatarStage v2.0: Cinematic Holographic Stage, Neural Stardust Particles,
 * Breathing Animation, Multi-Layer Parallax & Custom Cursor Engine
 */

class AvatarStage {
  constructor() {
    this.canvas = document.getElementById('stage-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.wrapper = document.getElementById('avatar-3d-wrapper');
    this.aura = document.getElementById('avatar-aura');
    this.avatarFigure = document.getElementById('avatar-figure-container');
    this.statusPill = document.getElementById('avatar-status-pill');
    this.statusLabel = document.getElementById('status-label');
    this.backdropImg = document.getElementById('backdrop-img');
    this.voicePortal = document.getElementById('voice-portal');

    // Custom Cursor Elements
    this.cursorDot = document.getElementById('cursor-dot');
    this.cursorAura = document.getElementById('cursor-aura');
    this.cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.auraPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    // Particles
    this.particles = [];
    this.particleCount = window.innerWidth < 768 ? 45 : 85;

    // Parallax state
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.parallax = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
    this.bgParallax = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };

    // Avatar breathing
    this.breathPhase = 0;

    // State
    this.currentState = 'idle';
    this.stateColors = {
      idle:      { primary: '#00e8f8', secondary: '#38bdf8', glow: 'rgba(0, 232, 248, 0.4)' },
      listening: { primary: '#00e8f8', secondary: '#10b981', glow: 'rgba(0, 232, 248, 0.6)' },
      thinking:  { primary: '#a855f7', secondary: '#6366f1', glow: 'rgba(168, 85, 247, 0.6)' },
      speaking:  { primary: '#ffd200', secondary: '#f59e0b', glow: 'rgba(255, 210, 0, 0.5)' },
      success:   { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16, 185, 129, 0.6)' }
    };

    this.initCanvas();
    this.initParticles();
    this.initEventListeners();
    this.animate();
  }

  initCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this._createParticle());
    }
  }

  _createParticle(fromCenter = false) {
    const x = fromCenter ? this.width / 2 : Math.random() * this.width;
    const y = fromCenter ? this.height * 0.5 : Math.random() * this.height;
    const colorRand = Math.random();
    let color;
    if (this.currentState === 'thinking') {
      color = colorRand > 0.5 ? '#a855f7' : '#6366f1';
    } else if (this.currentState === 'speaking') {
      color = colorRand > 0.5 ? '#ffd200' : '#f59e0b';
    } else if (this.currentState === 'success') {
      color = colorRand > 0.5 ? '#10b981' : '#34d399';
    } else {
      color = colorRand > 0.45 ? '#00e8f8' : (colorRand > 0.2 ? '#38bdf8' : 'rgba(255,255,255,0.8)');
    }

    return {
      x, y,
      radius: Math.random() * 2.2 + 0.4,
      vx: (Math.random() - 0.5) * 0.2,
      vy: -Math.random() * 0.3 - 0.06,
      alpha: Math.random() * 0.6 + 0.15,
      color,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.015 + Math.random() * 0.02
    };
  }

  initEventListeners() {
    // Mouse Parallax & Custom Cursor
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.cursorPos.x = e.clientX;
      this.cursorPos.y = e.clientY;

      if (this.cursorDot) {
        this.cursorDot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      }

      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1;

      this.parallax.targetX = normX * 8;
      this.parallax.targetY = -normY * 5;

      this.bgParallax.targetX = -normX * 12;
      this.bgParallax.targetY = -normY * 8;
    });

    // Custom Cursor Hover — add body class for CSS cursor styling
    const interactiveEls = document.querySelectorAll('button, a, input, select, textarea, .avatar-interactive-figure, .chip-action-btn, .lang-btn');
    interactiveEls.forEach((el) => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });

    // Mobile Gyroscope
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null) {
          const gamma = Math.max(-25, Math.min(25, e.gamma));
          const beta = Math.max(10, Math.min(50, e.beta));
          this.parallax.targetX = (gamma / 25) * 6;
          this.parallax.targetY = ((beta - 30) / 20) * -5;
        }
      });
    }
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    // Update aura class
    if (this.aura) {
      this.aura.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
      this.aura.classList.add(`state-${state}`);
    }

    // Update wrapper class (for CSS state-based styles)
    if (this.wrapper) {
      this.wrapper.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
      this.wrapper.classList.add(`state-${state}`);
    }

    // Update voice portal
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

    // Emit burst particles on state change
    this.triggerStateBurst(state);
  }

  triggerStateBurst(state) {
    if (!this.canvas) return;
    const color = this.stateColors[state] ? this.stateColors[state].primary : '#00e8f8';
    const centerX = this.width / 2;
    const centerY = this.height * 0.5;

    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = Math.random() * 3 + 1.5;
      this.particles.push({
        x: centerX,
        y: centerY,
        radius: Math.random() * 2.5 + 0.8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.9,
        color: color,
        pulse: 0,
        pulseSpeed: 0.04,
        decay: 0.02
      });
    }
  }

  updateParallax() {
    // Keep avatar figure completely static (no movement, no breathing, no rotation)
    if (this.avatarFigure) {
      this.avatarFigure.style.transform = 'none';
    }

    // Keep backdrop static so floor and feet stay perfectly anchored
    if (this.backdropImg) {
      this.backdropImg.style.transform = 'none';
    }

    // Trailing cursor aura follows mouse smoothly
    if (this.cursorAura) {
      this.auraPos.x += (this.cursorPos.x - this.auraPos.x) * 0.15;
      this.auraPos.y += (this.cursorPos.y - this.auraPos.y) * 0.15;
      this.cursorAura.style.transform = `translate(${this.auraPos.x}px, ${this.auraPos.y}px) translate(-50%, -50%)`;
    }
  }

  drawParticles() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Mouse-reactive drift influence
    const mouseInfluenceX = (this.mouse.x - this.width / 2) * 0.00008;
    const mouseInfluenceY = (this.mouse.y - this.height / 2) * 0.00005;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx + mouseInfluenceX;
      p.y += p.vy + mouseInfluenceY;
      p.pulse += p.pulseSpeed;

      if (p.decay) {
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
      } else {
        // Wrap around edges
        if (p.y < -10) { p.y = this.height + 10; p.x = Math.random() * this.width; }
        if (p.x < -10) p.x = this.width + 10;
        if (p.x > this.width + 10) p.x = -10;
      }

      const dynamicAlpha = Math.max(0, p.alpha * (0.5 + Math.sin(p.pulse) * 0.5));

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = dynamicAlpha;
      this.ctx.shadowBlur = p.radius * 6;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();
      this.ctx.restore();
    }

    // Maintain particle count (replace faded particles)
    while (this.particles.length < this.particleCount) {
      this.particles.push(this._createParticle());
    }
  }

  animate() {
    this.updateParallax();
    this.drawParticles();
    requestAnimationFrame(() => this.animate());
  }
}

window.AvatarStage = AvatarStage;
