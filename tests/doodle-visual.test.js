const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

function createMockElement(tag) {
  const children = [];
  const classes = new Set();
  const styleProps = {};
  const attrs = {};
  return {
    tagName: String(tag || 'div').toUpperCase(),
    className: '',
    textContent: '',
    innerHTML: '',
    offsetWidth: 180,
    offsetHeight: 120,
    clientWidth: 680,
    offsetLeft: 0,
    offsetTop: 0,
    children,
    get firstChild() {
      return children[0] || null;
    },
    style: {
      setProperty(k, v) { styleProps[k] = v; },
      getPropertyValue(k) { return styleProps[k]; }
    },
    classList: {
      add(...names) { names.forEach((n) => classes.add(n)); },
      remove(...names) { names.forEach((n) => classes.delete(n)); },
      toggle(n, force) {
        if (force === undefined) {
          if (classes.has(n)) { classes.delete(n); return false; }
          classes.add(n); return true;
        }
        if (force) classes.add(n); else classes.delete(n);
        return Boolean(force);
      },
      contains(n) { return classes.has(n); }
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return attrs[k] ?? null; },
    appendChild(child) { children.push(child); return child; },
    insertBefore(child, ref) {
      const idx = children.indexOf(ref);
      if (idx >= 0) children.splice(idx, 0, child);
      else children.unshift(child);
      return child;
    },
    remove() {},
    addEventListener() {},
    querySelector(sel) {
      if (sel.includes('doodle-panels')) {
        if (!this._panels) {
          this._panels = createMockElement('ol');
          this._panels.className = 'doodle-panels';
          children.push(this._panels);
        }
        return this._panels;
      }
      if (sel.includes('doodle-replay')) {
        if (!this._replay) {
          this._replay = createMockElement('button');
          this._replay.className = 'doodle-replay';
          children.push(this._replay);
        }
        return this._replay;
      }
      if (sel.includes('doodle-map-stage')) {
        if (!this._stage) {
          this._stage = createMockElement('div');
          this._stage.className = 'doodle-map-stage';
          children.push(this._stage);
        }
        return this._stage;
      }
      if (sel.includes('doodle-branches')) {
        if (!this._branches) {
          this._branches = createMockElement('ul');
          this._branches.className = 'doodle-branches';
          children.push(this._branches);
        }
        return this._branches;
      }
      if (sel.includes('doodle-center')) {
        if (!this._center) {
          this._center = createMockElement('div');
          this._center.className = 'doodle-center';
          children.push(this._center);
        }
        return this._center;
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '.doodle-panel') {
        const list = this._panels ? this._panels.children : children;
        return list.filter((c) => c.className === 'doodle-panel');
      }
      if (sel === '.doodle-branch') {
        const list = this._branches ? this._branches.children : children;
        return list.filter((c) => c.className === 'doodle-branch');
      }
      return [];
    }
  };
}

describe('DoodleVisual (comic-strip story & hand-drawn mind map)', () => {
  let DoodleVisual;

  beforeEach(() => {
    global.document = {
      createElement: (tag) => createMockElement(tag),
      createElementNS: (_ns, tag) => createMockElement(tag)
    };
    global.requestAnimationFrame = (cb) => cb();
    delete require.cache[require.resolve('../frontend/doodle-visual.js')];
    DoodleVisual = require('../frontend/doodle-visual.js');
  });

  it('renderStory returns null for fewer than 2 steps', () => {
    assert.equal(DoodleVisual.renderStory(null), null);
    assert.equal(DoodleVisual.renderStory([]), null);
    assert.equal(DoodleVisual.renderStory([{ label: 'Only one step', text: 'Single step' }]), null);
    assert.equal(DoodleVisual.renderStory([{ label: '', text: '' }, { label: 'Valid' }]), null);
  });

  it('renderStory renders 2-5 steps and caps at 5 panels', () => {
    const sevenSteps = Array.from({ length: 7 }, (_, i) => ({
      label: `Step ${i + 1}`,
      text: `Explanation for step ${i + 1}`
    }));
    const el = DoodleVisual.renderStory(sevenSteps);
    assert.ok(el, 'Expected story section element');
    assert.equal(el.className, 'doodle-story');
    const panels = el.querySelectorAll('.doodle-panel');
    assert.equal(panels.length, 5, 'Should cap at 5 panels');
  });

  it('pickEmoji maps keywords accurately (fossil -> 🦴, magnet -> 🧲)', () => {
    assert.equal(DoodleVisual.pickEmoji('How a fossil is formed in ancient bones', 0), '🦴');
    assert.equal(DoodleVisual.pickEmoji('A magnet has north and south poles that attract', 0), '🧲');
    assert.equal(DoodleVisual.pickEmoji('Bright sunlight and solar energy', 0), '☀️');
    assert.equal(DoodleVisual.pickEmoji('Unmatched generic concept xyz', 2), '⭐');
  });

  it('renderMindMap returns null without central or with fewer than 2 branches', () => {
    assert.equal(DoodleVisual.renderMindMap(null), null);
    assert.equal(DoodleVisual.renderMindMap({ central: '', branches: [{ label: 'A' }, { label: 'B' }] }), null);
    assert.equal(DoodleVisual.renderMindMap({ central: 'Fossils', branches: [] }), null);
    assert.equal(DoodleVisual.renderMindMap({ central: 'Fossils', branches: [{ label: 'Only one' }] }), null);

    const valid = DoodleVisual.renderMindMap({
      central: 'Fossils',
      branches: [
        { label: 'What they are', children: ['Ancient remains'] },
        { label: 'How they form', children: ['Mud turns to rock'] }
      ]
    });
    assert.ok(valid, 'Expected mind map section element for valid input');
    assert.equal(valid.className, 'doodle-mindmap');
    assert.equal(valid.querySelectorAll('.doodle-branch').length, 2);
  });
});
