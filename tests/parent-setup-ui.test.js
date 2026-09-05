const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Minimal DOM mock setup for ParentSetupUI tests
function setupDomMock() {
  const listeners = new Map();
  const elements = new Map();

  function createElement(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
        remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
        contains(c) { return this._classes.has(c); }
      },
      style: {},
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; },
      value: '',
      checked: false,
      textContent: '',
      innerHTML: '',
      disabled: false,
      children: [],
      appendChild(child) {
        this.children.push(child);
        if (child.id) elements.set(child.id, child);
        return child;
      },
      querySelector(sel) {
        if (sel === '.pos-tabs') return elements.get('pos-tabs-mock') || null;
        return null;
      },
      querySelectorAll(sel) {
        return [];
      },
      addEventListener(evt, handler) {
        const list = listeners.get(`${el.id || el.className}:${evt}`) || [];
        list.push(handler);
        listeners.set(`${el.id || el.className}:${evt}`, list);
      },
      async dispatchEvent(evt) {
        const list = listeners.get(`${el.id || el.className}:${evt.type}`) || [];
        for (const fn of list) {
          await fn(evt);
        }
      },
      focus() {},
      blur() {}
    };
    return el;
  }

  const ids = [
    'parent-setup-modal',
    'btn-parent-setup',
    'btn-close-parent-setup',
    'btn-hero-primary-schedule',
    'pos-step-auth',
    'pos-step-plan',
    'pos-step-child',
    'pos-step-pers',
    'pos-step-success',
    'pos-step-tracker',
    'pos-alert',
    'pos-auth-form',
    'pos-tab-login',
    'pos-tab-signup',
    'pos-auth-email',
    'pos-auth-password',
    'pos-auth-household',
    'pos-household-wrap',
    'pos-btn-auth-submit',
    'pos-plans-container',
    'pos-plan-status',
    'pos-child-list',
    'pos-child-form-wrap',
    'pos-child-form',
    'pos-child-name',
    'pos-child-grade',
    'pos-pers-form',
    'pos-pers-child-name',
    'pos-pers-lang',
    'pos-pers-style',
    'pos-pers-font',
    'pos-pers-response',
    'pos-pers-theme',
    'pos-pers-subjects',
    'pos-pers-interests',
    'pos-pers-goals',
    'pos-parent-phone',
    'pos-whatsapp-consent',
    'pos-btn-pers-submit',
    'pos-btn-launch'
  ];

  ids.forEach((id) => {
    const el = createElement(id.includes('consent') ? 'input' : 'div');
    el.id = id;
    elements.set(id, el);
  });

  const tabMock = createElement('div');
  tabMock.id = 'pos-tabs-mock';
  tabMock.className = 'pos-tabs';
  elements.get('pos-step-auth').appendChild(tabMock);

  global.document = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    createElement(tag) {
      return createElement(tag);
    },
    activeElement: null
  };

  global.window = {
    document: global.document,
    location: {
      origin: 'https://appuai.online',
      hash: '',
      search: '',
      pathname: '/'
    },
    requestAnimationFrame(fn) { fn(); }
  };

  return { elements, listeners };
}

describe('Parent Personalization UI & WhatsApp Consent Flow', () => {
  const frontendDir = path.resolve(__dirname, '../frontend');

  test('Step 4 DOM in index.html contains #pos-parent-phone, #pos-whatsapp-consent, and rationale copy', () => {
    const html = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');

    // Must contain phone input with type="tel"
    assert.match(
      html,
      /<input[^>]*id=["']pos-parent-phone["'][^>]*type=["']tel["']|<input[^>]*type=["']tel["'][^>]*id=["']pos-parent-phone["']/i,
      'index.html must contain #pos-parent-phone with type="tel"'
    );

    // Must contain whatsapp consent checkbox
    assert.match(
      html,
      /<input[^>]*id=["']pos-whatsapp-consent["'][^>]*type=["']checkbox["']|<input[^>]*type=["']checkbox["'][^>]*id=["']pos-whatsapp-consent["']/i,
      'index.html must contain #pos-whatsapp-consent checkbox'
    );

    // Checkbox must NOT be checked by default
    const consentMatch = html.match(/<input[^>]*id=["']pos-whatsapp-consent["'][^>]*>/i);
    assert.ok(consentMatch, '#pos-whatsapp-consent must exist');
    assert.ok(!consentMatch[0].includes('checked'), '#pos-whatsapp-consent must NOT be checked by default');

    // Must contain "why we ask" rationale copy
    assert.ok(
      html.includes('WhatsApp') || html.includes('whatsapp'),
      'Step 4 must mention WhatsApp'
    );
    assert.match(
      html,
      /learning milestone|study note|study summar|learning update/i,
      'Rationale copy must explain why phone is requested (e.g. study notes / learning milestones)'
    );
  });

  describe('Personalization Form Submission & Client-Side Validation', () => {
    let dom;
    let savedData;
    let ParentSetupUI;

    beforeEach(() => {
      dom = setupDomMock();
      savedData = null;

      global.window.ParentOnboardingShell = {
        state: {
          session: { access_token: 'fake-jwt' },
          selectedChild: { id: 'child-uuid-1', preferredName: 'Vihaan' }
        },
        async fetchPersonalisation() {
          return null;
        },
        async savePersonalisation(childId, data) {
          savedData = { childId, data };
          return data;
        }
      };

      // Load fresh module
      delete require.cache[require.resolve('../frontend/parent-setup-ui.js')];
      ParentSetupUI = require('../frontend/parent-setup-ui.js');
      ParentSetupUI.init();
    });

    test('saving personalization includes parentPhone and whatsappConsent: true when checked', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const phoneInput = dom.elements.get('pos-parent-phone');
      const consentBox = dom.elements.get('pos-whatsapp-consent');

      phoneInput.value = '9876543210';
      consentBox.checked = true;

      await persForm.dispatchEvent({
        type: 'submit',
        preventDefault() {}
      });

      assert.ok(savedData, 'savePersonalisation must have been called');
      assert.equal(savedData.data.parentPhone, '+919876543210');
      assert.equal(savedData.data.whatsappConsent, true);
    });

    test('entering phone without checking consent sends whatsappConsent: false', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const phoneInput = dom.elements.get('pos-parent-phone');
      const consentBox = dom.elements.get('pos-whatsapp-consent');

      phoneInput.value = '+919876543210';
      consentBox.checked = false;

      await persForm.dispatchEvent({
        type: 'submit',
        preventDefault() {}
      });

      assert.ok(savedData, 'savePersonalisation must have been called');
      assert.equal(savedData.data.parentPhone, '+919876543210');
      assert.equal(savedData.data.whatsappConsent, false);
    });

    test('empty phone without consent sends parentPhone: null and whatsappConsent: false', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const phoneInput = dom.elements.get('pos-parent-phone');
      const consentBox = dom.elements.get('pos-whatsapp-consent');

      phoneInput.value = '';
      consentBox.checked = false;

      await persForm.dispatchEvent({
        type: 'submit',
        preventDefault() {}
      });

      assert.ok(savedData, 'savePersonalisation must have been called');
      assert.equal(savedData.data.parentPhone, null);
      assert.equal(savedData.data.whatsappConsent, false);
    });

    test('invalid phone triggers user-friendly validation banner without submitting', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const phoneInput = dom.elements.get('pos-parent-phone');
      const alertBox = dom.elements.get('pos-alert');

      phoneInput.value = 'invalid-phone-123';

      await persForm.dispatchEvent({
        type: 'submit',
        preventDefault() {}
      });

      assert.equal(savedData, null, 'savePersonalisation must NOT be called on invalid phone');
      assert.equal(alertBox.style.display, 'block');
      assert.ok(alertBox.textContent.length > 0);
    });

    test('checking consent with empty phone triggers friendly validation banner without submitting', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const phoneInput = dom.elements.get('pos-parent-phone');
      const consentBox = dom.elements.get('pos-whatsapp-consent');
      const alertBox = dom.elements.get('pos-alert');

      phoneInput.value = '';
      consentBox.checked = true;

      await persForm.dispatchEvent({
        type: 'submit',
        preventDefault() {}
      });

      assert.equal(savedData, null, 'savePersonalisation must NOT be called when consent checked without phone');
      assert.equal(alertBox.style.display, 'block');
      assert.ok(alertBox.textContent.length > 0);
    });
  });
});
