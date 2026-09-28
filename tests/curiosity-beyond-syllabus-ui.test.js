const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function createMockElement(tag = 'div', id = '') {
  return {
    tagName: tag.toUpperCase(),
    id,
    className: '',
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this.contains(c)) this.remove(c); else this.add(c);
        } else if (force) {
          this.add(c);
        } else {
          this.remove(c);
        }
      }
    },
    hidden: false,
    innerHTML: '',
    textContent: '',
    children: [],
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    hasAttribute(k) { return k in this.attributes; },
    removeAttribute(k) { delete this.attributes[k]; },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    querySelector(sel) {
      return null;
    },
    querySelectorAll(sel) {
      return [];
    },
    _listeners: {},
    addEventListener(event, fn) {
      this._listeners[event] = this._listeners[event] || [];
      this._listeners[event].push(fn);
    }
  };
}

describe('Curiosity Beyond Syllabus UI & Section (Phase C)', () => {
  test('index.html contains #report-curiosity-section inside #report-view-unlocked with positive framing', () => {
    const htmlPath = path.join(__dirname, '..', 'frontend', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="report-curiosity-section"'), 'Must have #report-curiosity-section');
    assert.ok(html.includes('id="report-curiosity-list"'), 'Must have #report-curiosity-list');
    assert.ok(html.includes('Curiosity Beyond Syllabus 🌟'), 'Must have positive title');
    assert.ok(html.includes('We celebrate their enthusiasm for learning beyond grade-level expectations!'), 'Must have positive description');
    
    // Verify it is initially hidden
    const curiositySectionSnippet = html.slice(html.indexOf('id="report-curiosity-section"'));
    const tagSnippet = curiositySectionSnippet.slice(0, curiositySectionSnippet.indexOf('>'));
    assert.ok(tagSnippet.includes('hidden'), 'Section must be hidden by default');
  });

  test('ParentReportsUI.renderCuriosityItems renders positive cards and unhides section for valid items', () => {
    // Setup mock DOM environment
    const modal = createMockElement('div', 'reports-modal');
    const section = createMockElement('div', 'report-curiosity-section');
    section.hidden = true;
    const list = createMockElement('div', 'report-curiosity-list');

    modal.querySelector = (sel) => {
      if (sel === '#report-curiosity-section') return section;
      if (sel === '#report-curiosity-list') return list;
      return null;
    };

    global.window = {
      ParentOnboardingShell: { state: { session: { access_token: 'test-tok' }, selectedChild: { id: 'child-123' } } },
      AppuSession: { accessToken: 'test-tok', childId: 'child-123' },
      APPU_CONFIG: { apiBaseUrl: 'http://localhost:3000' }
    };
    global.document = {
      readyState: 'complete',
      getElementById: (id) => (id === 'reports-modal' ? modal : null),
      createElement: (tag) => createMockElement(tag),
      createTextNode: (text) => ({ textContent: text, nodeType: 3 })
    };

    // Load parent-reports-ui.js
    const scriptPath = path.join(__dirname, '..', 'frontend', 'parent-reports-ui.js');
    const code = fs.readFileSync(scriptPath, 'utf8');
    eval(code);

    assert.ok(window.ParentReportsUI, 'ParentReportsUI must be exposed');

    const sampleItems = [
      { topic: 'Quantum Superposition', expectedGrade: 'Grade 11', when: '2026-09-24T10:00:00Z' },
      { topic: 'Quadratic Curves', expectedGrade: 'Grade 9', when: '2026-09-25T14:30:00Z' }
    ];

    window.ParentReportsUI.renderCuriosityItems(sampleItems);

    assert.equal(section.hidden, false, 'Section must be unhidden when items exist');
    assert.equal(list.children.length, 2, 'Must render 2 curiosity cards');

    // First card inspection
    const firstCard = list.children[0];
    assert.equal(firstCard.className, 'report-curiosity-card');
    assert.equal(firstCard.children[0].textContent, 'Quantum Superposition');
    
    // Meta container inspection (badge + date)
    const metaContainer = firstCard.children[1];
    assert.ok(metaContainer.children.length >= 1, 'Should have meta children');
    const badge = metaContainer.children[0];
    assert.equal(badge.className, 'report-curiosity-badge');
  });

  test('ParentReportsUI.renderCuriosityItems hides section when curiosity array is empty or null', () => {
    const modal = createMockElement('div', 'reports-modal');
    const section = createMockElement('div', 'report-curiosity-section');
    section.hidden = false;
    const list = createMockElement('div', 'report-curiosity-list');
    list.children = [createMockElement('div')];

    modal.querySelector = (sel) => {
      if (sel === '#report-curiosity-section') return section;
      if (sel === '#report-curiosity-list') return list;
      return null;
    };

    global.window = {
      ParentOnboardingShell: { state: {} },
      AppuSession: {},
      APPU_CONFIG: {}
    };
    global.document = {
      readyState: 'complete',
      getElementById: (id) => (id === 'reports-modal' ? modal : null),
      createElement: (tag) => createMockElement(tag),
      createTextNode: (text) => ({ textContent: text })
    };

    const scriptPath = path.join(__dirname, '..', 'frontend', 'parent-reports-ui.js');
    eval(fs.readFileSync(scriptPath, 'utf8'));

    // 1. Empty array
    window.ParentReportsUI.renderCuriosityItems([]);
    assert.equal(section.hidden, true, 'Section must be hidden for empty items');
    assert.equal(list.innerHTML, '');

    // 2. Null/undefined
    section.hidden = false;
    window.ParentReportsUI.renderCuriosityItems(null);
    assert.equal(section.hidden, true, 'Section must be hidden for null items');
  });

  test('ParentReportsUI.renderCuriosityItems gracefully omits grade badge when expectedGrade is null', () => {
    const modal = createMockElement('div', 'reports-modal');
    const section = createMockElement('div', 'report-curiosity-section');
    section.hidden = true;
    const list = createMockElement('div', 'report-curiosity-list');

    modal.querySelector = (sel) => {
      if (sel === '#report-curiosity-section') return section;
      if (sel === '#report-curiosity-list') return list;
      return null;
    };

    global.window = {
      ParentOnboardingShell: { state: {} },
      AppuSession: {},
      APPU_CONFIG: {}
    };
    global.document = {
      readyState: 'complete',
      getElementById: (id) => (id === 'reports-modal' ? modal : null),
      createElement: (tag) => createMockElement(tag),
      createTextNode: (text) => ({ textContent: text })
    };

    const scriptPath = path.join(__dirname, '..', 'frontend', 'parent-reports-ui.js');
    eval(fs.readFileSync(scriptPath, 'utf8'));

    // Render an item with expectedGrade: null
    window.ParentReportsUI.renderCuriosityItems([
      { topic: 'Astrophysics & Black Holes', expectedGrade: null, when: '2026-09-26T12:00:00Z' }
    ]);

    assert.equal(section.hidden, false);
    assert.equal(list.children.length, 1);
    const card = list.children[0];
    assert.equal(card.children[0].textContent, 'Astrophysics & Black Holes');

    // Meta container should contain only date, NO badge
    const metaContainer = card.children[1];
    assert.equal(metaContainer.children.length, 1);
    const dateSpan = metaContainer.children[0];
    assert.equal(dateSpan.className, 'report-curiosity-date');
  });
});
