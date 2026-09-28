const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const MascotAvatar = require('../frontend/mascot-avatar.js');

function createMockElement(tag = 'div', id = '', className = '') {
  const el = {
    tagName: tag.toUpperCase(),
    id,
    className,
    classList: {
      _classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
      add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
      remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this.contains(c)) this.remove(c); else this.add(c);
        } else if (force) this.add(c); else this.remove(c);
      }
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; },
    textContent: '',
    _innerHTML: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(val) {
      this._innerHTML = val;
      // Parse child nodes mockingly for querySelector lookup
      this._children = [];
      const classMatches = val.matchAll(/class="([^"]+)"/g);
      for (const m of classMatches) {
        const classes = m[1].split(/\s+/);
        for (const cls of classes) {
          const child = createMockElement('div', '', cls);
          this._children.push(child);
        }
      }
    },
    querySelector(selector) {
      if (!selector) return null;
      const targetClass = selector.startsWith('.') ? selector.slice(1) : selector;
      if (this._children) {
        for (const ch of this._children) {
          if (ch.classList.contains(targetClass)) return ch;
        }
      }
      // Create and cache on the fly so setters work
      const matched = createMockElement('div', '', targetClass);
      if (!this._children) this._children = [];
      this._children.push(matched);
      return matched;
    }
  };
  return el;
}

describe('APPU Mascot Avatar Unit Tests', () => {
  test('MascotAvatar class is exported with canon moods and face expressions', () => {
    assert.ok(MascotAvatar);
    assert.deepEqual(MascotAvatar.MOODS, ['idle', 'listening', 'thinking', 'explaining', 'celebrating']);
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.idle.left, '>');
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.idle.right, '=');
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.listening.right, 'o');
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.thinking.right, '~');
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.explaining.right, '▽');
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.celebrating.left, '^');
    assert.equal(MascotAvatar.FACE_EXPRESSIONS.celebrating.right, '^');
  });

  test('instantiation without container succeeds gracefully without throwing', () => {
    const mascot = new MascotAvatar(null);
    assert.equal(mascot.getMood(), 'idle');
    mascot.destroy();
  });

  test('renders SVG structure into container and initializes in idle mood', () => {
    const container = createMockElement('div', 'appu-mascot-container');
    const mascot = new MascotAvatar(container);

    assert.ok(container.classList.contains('appu-mascot-host'));
    assert.ok(container.innerHTML.includes('appu-mascot-svg'));
    assert.ok(container.innerHTML.includes('appu-body-grad'));
    assert.ok(container.innerHTML.includes('mascot-floater'));
    assert.ok(container.innerHTML.includes('mascot-screen'));
    assert.equal(mascot.getMood(), 'idle');
  });

  test('state machine transitions across all 5 canonical moods and updates face expression', () => {
    const container = createMockElement('div', 'appu-mascot-container');
    let moodReported = null;
    const mascot = new MascotAvatar(container, {
      onMoodChange: (m) => { moodReported = m; }
    });

    // 1. Listening
    mascot.listen();
    assert.equal(mascot.getMood(), 'listening');
    assert.equal(moodReported, 'listening');
    assert.ok(mascot.wrapper.classList.contains('mood-listening'));
    assert.equal(mascot.eyeLeft.textContent, '>');
    assert.equal(mascot.eyeRight.textContent, 'o');

    // 2. Thinking
    mascot.think();
    assert.equal(mascot.getMood(), 'thinking');
    assert.equal(moodReported, 'thinking');
    assert.ok(mascot.wrapper.classList.contains('mood-thinking'));
    assert.equal(mascot.eyeRight.textContent, '~');

    // 3. Explaining
    mascot.explain();
    assert.equal(mascot.getMood(), 'explaining');
    assert.equal(moodReported, 'explaining');
    assert.ok(mascot.wrapper.classList.contains('mood-explaining'));
    assert.equal(mascot.eyeRight.textContent, '▽');

    // 4. Celebrating
    mascot.celebrate(0);
    assert.equal(mascot.getMood(), 'celebrating');
    assert.equal(moodReported, 'celebrating');
    assert.ok(mascot.wrapper.classList.contains('mood-celebrating'));
    assert.equal(mascot.eyeLeft.textContent, '^');
    assert.equal(mascot.eyeRight.textContent, '^');

    // 5. Idle
    mascot.idle();
    assert.equal(mascot.getMood(), 'idle');
    assert.equal(moodReported, 'idle');
    assert.ok(mascot.wrapper.classList.contains('mood-idle'));
    assert.equal(mascot.eyeRight.textContent, '=');
  });

  test('invalid mood input safely defaults to idle', () => {
    const container = createMockElement('div', 'appu-mascot-container');
    const mascot = new MascotAvatar(container);

    mascot.setMood('unknown-mood-invalid');
    assert.equal(mascot.getMood(), 'idle');
    assert.ok(mascot.wrapper.classList.contains('mood-idle'));
  });

  test('auto-revert timer restores idle state after duration', (t, done) => {
    const container = createMockElement('div', 'appu-mascot-container');
    const mascot = new MascotAvatar(container);

    mascot.celebrate(30); // 30ms auto-revert
    assert.equal(mascot.getMood(), 'celebrating');

    setTimeout(() => {
      assert.equal(mascot.getMood(), 'idle');
      mascot.destroy();
      done();
    }, 60);
  });
});
