const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// Minimal DOM mock setup for Node test environment
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
        if (sel === '.pos-step-dot') return [];
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
    'pos-btn-launch'
  ];

  ids.forEach((id) => {
    const el = createElement('div');
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

describe('ParentSetupUI Verification & Success Flow Tests', () => {
  let dom;

  beforeEach(() => {
    dom = setupDomMock();
  });

  test('successful signup renders verification state and does NOT show error alert', async () => {
    const ParentOnboardingShell = require('../frontend/parent-onboarding-shell.js');
    const ParentSetupUI = require('../frontend/parent-setup-ui.js');

    global.window.ParentOnboardingShell = {
      state: { session: null, authStatus: 'UNAUTHENTICATED' },
      async signInParent({ email, password, isSignUp }) {
        assert.equal(isSignUp, true);
        assert.equal(email, 'parent@example.com');
        return {
          status: 'VERIFICATION_REQUIRED',
          needsVerification: true,
          email,
          message: 'We sent a verification link'
        };
      }
    };

    ParentSetupUI.init();

    const authEmail = dom.elements.get('pos-auth-email');
    const authPassword = dom.elements.get('pos-auth-password');
    const tabSignup = dom.elements.get('pos-tab-signup');
    const authForm = dom.elements.get('pos-auth-form');
    const alertBox = dom.elements.get('pos-alert');

    authEmail.value = 'parent@example.com';
    authPassword.value = 'SecretPass123!';

    // Click signup tab
    await tabSignup.dispatchEvent({ type: 'click' });

    // Submit signup
    await authForm.dispatchEvent({
      type: 'submit',
      preventDefault() {}
    });

    // Verify: error alert is NOT shown
    assert.equal(alertBox.style.display, 'none');

    // Verify: verification container was rendered
    const verifyWrap = dom.elements.get('pos-verify-wrap');
    assert.ok(verifyWrap, 'Verification wrapper must be created');
    assert.equal(verifyWrap.style.display, 'block');
    assert.ok(verifyWrap.innerHTML.includes('Check your email'));
    assert.ok(verifyWrap.innerHTML.includes('parent@example.com'));
    assert.ok(verifyWrap.innerHTML.includes("I've verified my email"));
    assert.ok(verifyWrap.innerHTML.includes('Resend verification email'));
  });

  test('failed signup displays error banner with error message', async () => {
    const ParentSetupUI = require('../frontend/parent-setup-ui.js');

    global.window.ParentOnboardingShell = {
      state: { session: null, authStatus: 'UNAUTHENTICATED' },
      async signInParent() {
        throw new Error('Email address already registered');
      }
    };

    ParentSetupUI.init();

    const authEmail = dom.elements.get('pos-auth-email');
    const authPassword = dom.elements.get('pos-auth-password');
    const tabSignup = dom.elements.get('pos-tab-signup');
    const authForm = dom.elements.get('pos-auth-form');
    const alertBox = dom.elements.get('pos-alert');

    authEmail.value = 'duplicate@example.com';
    authPassword.value = 'Password123!';

    await tabSignup.dispatchEvent({ type: 'click' });

    await authForm.dispatchEvent({
      type: 'submit',
      preventDefault() {}
    });

    // Verify: error alert IS shown with failure styling
    assert.equal(alertBox.style.display, 'block');
    assert.ok(alertBox.className.includes('error'));
    assert.equal(alertBox.textContent, 'Email address already registered');
  });

  test('different device returning with hash #type=signup shows success notice on opening modal', () => {
    const ParentSetupUI = require('../frontend/parent-setup-ui.js');

    global.window.location.hash = '#type=signup&message=Confirmation+success';
    global.window.ParentOnboardingShell = {
      state: { session: null, authStatus: 'UNAUTHENTICATED' }
    };

    ParentSetupUI.init();
    ParentSetupUI.openModal(1);

    const alertBox = dom.elements.get('pos-alert');
    assert.equal(alertBox.style.display, 'block');
    assert.ok(alertBox.className.includes('success'));
    assert.ok(alertBox.textContent.includes('Email verified successfully'));
  });
});
