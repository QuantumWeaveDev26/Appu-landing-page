/**
 * AvatarStage: Interactive 3D Spatial Canvas, Perspective Ground Grid & State Choreography Engine
 */

class AvatarStage {
  constructor() {
    this.canvas = document.getElementById('stage-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.wrapper = document.getElementById('avatar-3d-wrapper');
    this.aura = document.getElementById('avatar-aura');
    this.statusPill = document.getElementById('avatar-status-pill');
    this.statusLabel = document.getElementById('status-label');
    this.spotlight = document.getElementById('spotlight-cone');

    this.particles = [];
    this.particleCount = window.innerWidth < 768 ? 50 : 100;
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.parallax = { currentX: 0, currentY: 0, targetX: 0, targetY: 0 };

    this.currentState = 'idle'; // 'idle', 'listening', 'thinking', 'speaking', 'success'
    this.stateColors = {
      idle: { primary: '#00f2fe', secondary: '#4facfe', glow: 'rgba(0, 242, 254, 0.4)' },
      listening: { primary: '#00f2fe', secondary: '#10b981', glow: 'rgba(0, 242, 254, 0.7)' },
      thinking: { primary: '#a855f7', secondary: '#6366f1', glow: 'rgba(168, 85, 247, 0.7)' },
      speaking: { primary: '#ffd200', secondary: '#f7971e', glow: 'rgba(255, 210, 0, 0.65)' },
      success: { primary: '#34d399', secondary: '#10b981', glow: 'rgba(52, 211, 153, 0.8)' }
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
        radius: Math.random() * 2.2 + 0.6,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.45 - 0.15,
        alpha: Math.random() * 0.75 + 0.25,
        color: Math.random() > 0.45 ? '#00f2fe' : (Math.random() > 0.5 ? '#a855f7' : '#ffd200'),
        pulse: Math.random() * Math.PI,
        pulseSpeed: 0.02 + Math.random() * 0.03
      });
    }
  }

  initEventListeners() {
    // Desktop Mouse Parallax & Dynamic Spotlight Tracking
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1;

      this.parallax.targetX = normX * 12; // degrees
      this.parallax.targetY = -normY * 8;

      if (this.spotlight) {
        const spotX = 50 + normX * 10;
        this.spotlight.style.background = `radial-gradient(ellipse at ${spotX}% 0%, rgba(0, 242, 254, 0.22) 0%, rgba(79, 172, 254, 0.05) 50%, transparent 80%)`;
      }
    });

    // Mobile Device Orientation Gyroscope
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma !== null && e.beta !== null) {
          const gamma = Math.max(-30, Math.min(30, e.gamma));
          const beta = Math.max(10, Math.min(60, e.beta));
          this.parallax.targetX = (gamma / 30) * 10;
          this.parallax.targetY = ((beta - 35) / 25) * -7;
        }
      });
    }
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    // Reset classes
    this.wrapper.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking', 'state-success');
    this.statusPill.classList.remove('idle', 'listening', 'thinking', 'speaking', 'success');

    this.wrapper.classList.add(`state-${state}`);
    this.statusPill.classList.add(state);

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

    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28;
      const speed = Math.random() * 3.5 + 2;
      this.particles.push({
        x: centerX,
        y: centerY,
        radius: Math.random() * 3.5 + 1.2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: color,
        pulse: 0,
        pulseSpeed: 0.05,
        decay: 0.02
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
  }

  drawPerspectiveGrid() {
    const horizon = this.height * 0.72;
    const bottom = this.height;
    const centerX = this.width / 2;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
    this.ctx.lineWidth = 1;

    // Perspective lines radiating from center
    const lineCount = 14;
    for (let i = -lineCount; i <= lineCount; i++) {
      const xBottom = centerX + i * (this.width / 16);
      this.ctx.beginPath();
      this.ctx.moveTo(centerX, horizon);
      this.ctx.lineTo(xBottom, bottom);
      this.ctx.stroke();
    }

    // Horizontal depth rings
    for (let y = horizon + 15; y <= bottom; y += (y - horizon) * 0.35 + 8) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  drawParticles() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw cyber grid floor
    this.drawPerspectiveGrid();

    // Draw floating nebula dust
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
      this.ctx.shadowBlur = 14;
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
