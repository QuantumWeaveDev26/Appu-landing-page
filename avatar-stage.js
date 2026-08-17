/**
 * AvatarStage: Sleek Keynote Auditorium 3D Spatial Canvas, Neural Stardust & Multi-Layer Parallax Engine
 */

class AvatarStage {
  constructor() {
    this.canvas = document.getElementById('stage-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.wrapper = document.getElementById('avatar-3d-wrapper');
    this.aura = document.getElementById('avatar-aura');
    this.statusPill = document.getElementById('avatar-status-pill');
    this.statusLabel = document.getElementById('status-label');
    this.backdropImg = document.getElementById('backdrop-img');

    // Custom Cursor Elements
    this.cursorDot = document.getElementById('cursor-dot');
    this.cursorAura = document.getElementById('cursor-aura');
    this.cursorPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.auraPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    this.particles = [];
    this.particleCount = window.innerWidth < 768 ? 35 : 70;
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.parallax = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };
    this.bgParallax = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };

    this.currentState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking', 'success'
    this.stateColors = {
      idle: { primary: '#00f2fe', secondary: '#38bdf8', glow: 'rgba(0, 242, 254, 0.4)' },
      listening: { primary: '#00f2fe', secondary: '#10b981', glow: 'rgba(0, 242, 254, 0.7)' },
      thinking: { primary: '#a855f7', secondary: '#6366f1', glow: 'rgba(168, 85, 247, 0.7)' },
      speaking: { primary: '#ffd200', secondary: '#f59e0b', glow: 'rgba(255, 210, 0, 0.65)' },
      success: { primary: '#10b981', secondary: '#34d399', glow: 'rgba(16, 185, 129, 0.8)' }
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
    this.width = this.canvas.width = window.innerWidth;
    this.height = this.canvas.height = window.innerHeight;
  }

  initParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: Math.random() * 2.0 + 0.5,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -Math.random() * 0.35 - 0.08,
        alpha: Math.random() * 0.65 + 0.2,
        color: Math.random() > 0.4 ? '#00f2fe' : (Math.random() > 0.5 ? '#ffd200' : '#ffffff'),
        pulse: Math.random() * Math.PI,
        pulseSpeed: 0.02 + Math.random() * 0.025
      });
    }
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

      this.parallax.targetX = normX * 10; // degrees
      this.parallax.targetY = -normY * 6;

      this.bgParallax.targetX = -normX * 14; // px
      this.bgParallax.targetY = -normY * 10;
    });

    // Custom Cursor Hover
    document.querySelectorAll('button, a, .spatial-node, input, select, .avatar-interactive-figure').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        if (this.cursorAura) this.cursorAura.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        if (this.cursorAura) this.cursorAura.classList.remove('cursor-hover');
      });
    });

    // Mobile Gyroscope
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null) {
          const gamma = Math.max(-25, Math.min(25, e.gamma));
          const beta = Math.max(10, Math.min(50, e.beta));
          this.parallax.targetX = (gamma / 25) * 8;
          this.parallax.targetY = ((beta - 30) / 20) * -6;
        }
      });
    }
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    if (this.wrapper) {
      this.wrapper.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
      this.wrapper.classList.add(`state-${state}`);
    }

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

    this.triggerStateBurst(state);
  }

  triggerStateBurst(state) {
    const color = this.stateColors[state] ? this.stateColors[state].primary : '#00f2fe';
    const centerX = this.width / 2;
    const centerY = this.height * 0.52;

    for (let i = 0; i < 25; i++) {
      const angle = (Math.PI * 2 * i) / 25;
      const speed = Math.random() * 3.5 + 2.0;
      this.particles.push({
        x: centerX,
        y: centerY,
        radius: Math.random() * 3.0 + 1.0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: color,
        pulse: 0,
        pulseSpeed: 0.05,
        decay: 0.025
      });
    }
  }

  updateParallax() {
    this.parallax.currentX += (this.parallax.targetX - this.parallax.currentX) * 0.08;
    this.parallax.currentY += (this.parallax.targetY - this.parallax.currentY) * 0.08;

    if (this.wrapper) {
      this.wrapper.style.transform = `
        rotateY(${this.parallax.currentX}deg) 
        rotateX(${this.parallax.currentY}deg) 
        translateZ(20px)
      `;
    }

    // Auditorium Backdrop Parallax
    if (this.backdropImg) {
      this.bgParallax.currentX += (this.bgParallax.targetX - this.bgParallax.currentX) * 0.05;
      this.bgParallax.currentY += (this.bgParallax.targetY - this.bgParallax.currentY) * 0.05;
      this.backdropImg.style.transform = `scale(1.04) translate(${this.bgParallax.currentX}px, ${this.bgParallax.currentY}px)`;
    }

    // Trailing Cursor Aura
    if (this.cursorAura) {
      this.auraPos.x += (this.cursorPos.x - this.auraPos.x) * 0.18;
      this.auraPos.y += (this.cursorPos.y - this.auraPos.y) * 0.18;
      this.cursorAura.style.transform = `translate(${this.auraPos.x}px, ${this.auraPos.y}px) translate(-50%, -50%)`;
    }
  }

  drawParticles() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      p.x += p.vx;
      p.y += p.vy;
      p.pulse += p.pulseSpeed;

      if (p.decay) {
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
      } else {
        if (p.y < -10) p.y = this.height + 10;
        if (p.x < -10) p.x = this.width + 10;
        if (p.x > this.width + 10) p.x = -10;
      }

      const dynamicAlpha = Math.max(0, p.alpha * (0.6 + Math.sin(p.pulse) * 0.4));

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = dynamicAlpha;
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = p.color;
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  animate() {
    this.updateParallax();
    this.drawParticles();
    requestAnimationFrame(() => this.animate());
  }
}

window.AvatarStage = AvatarStage;
