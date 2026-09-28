const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createTestContext() {
  const elements = new Map();
  const listeners = new Map();

  function makeElement(id, tagName = 'div') {
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      className: '',
      hidden: false,
      disabled: false,
      value: '',
      textContent: '',
      innerHTML: '',
      style: {},
      attributes: {},
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
        remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
        contains(c) { return this._classes.has(c); },
        toggle(c, force) {
          if (force === undefined) {
            if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c);
          } else if (force) {
            this._classes.add(c);
          } else {
            this._classes.delete(c);
          }
          el.className = Array.from(this._classes).join(' ');
        }
      },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k]; },
      removeAttribute(k) { delete this.attributes[k]; },
      focus() { el.isFocused = true; },
      blur() { el.isFocused = false; },
      querySelector(sel) {
        if (sel === '.modal-kicker') return elements.get('modal-kicker');
        if (sel === '.modal-lead') return elements.get('modal-lead');
        if (sel === '.parental-lock-stats') return elements.get('parental-lock-stats');
        if (sel === '.lock-instruction') return elements.get('lock-instruction');
        if (sel === '.otp-sent-banner span') return elements.get('otp-sent-banner-span');
        if (sel === '.lock-field > span') return elements.get('lock-field-span');
        if (sel === '.success-view h3') return elements.get('success-view-h3');
        if (sel === '.success-view p') return elements.get('success-view-p');
        if (sel === 'span') return { textContent: '' };
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.lock-stat-label') {
          return [elements.get('stat-label-active'), elements.get('stat-label-away')];
        }
        return [];
      },
      addEventListener(evt, fn) {
        const key = `${id}:${evt}`;
        if (!listeners.has(key)) listeners.set(key, []);
        listeners.get(key).push(fn);
      },
      dispatchEvent(evt) {
        const key = `${id}:${evt.type}`;
        const fns = listeners.get(key) || [];
        for (const fn of fns) fn(evt);
      }
    };
    elements.set(id, el);
    return el;
  }

  // Pre-populate required elements
  makeElement('parental-lock-modal', 'section');
  makeElement('modal-kicker', 'div');
  makeElement('parental-lock-title', 'h2');
  makeElement('modal-lead', 'p');
  makeElement('parental-lock-stats', 'div');
  makeElement('stat-label-active', 'span');
  makeElement('stat-label-away', 'span');
  makeElement('lock-stat-active', 'strong');
  makeElement('lock-stat-away', 'strong');
  makeElement('lock-view-request', 'div');
  makeElement('lock-view-verify', 'div');
  makeElement('lock-view-success', 'div');
  makeElement('lock-instruction', 'p');
  makeElement('lock-btn-request-otp', 'button');
  makeElement('lock-btn-verify-otp', 'button');
  makeElement('lock-btn-resend-otp', 'button');
  makeElement('lock-btn-add-phone', 'button');
  makeElement('lock-otp-input', 'input');
  makeElement('lock-request-status', 'p');
  makeElement('lock-verify-status', 'p');
  makeElement('parental-timer-badge', 'div');
  makeElement('parental-timer-text', 'span');
  makeElement('otp-sent-banner-span', 'span');
  makeElement('lock-field-span', 'span');
  makeElement('success-view-h3', 'h3');
  makeElement('success-view-p', 'p');

  const documentMock = {
    getElementById(id) {
      return elements.get(id) || null;
    },
    querySelector(sel) {
      return elements.get('parental-lock-modal')?.querySelector(sel) || null;
    },
    querySelectorAll(sel) {
      return [];
    },
    documentElement: { lang: 'en', setAttribute() {}, getAttribute() { return 'en'; } },
    visibilityState: 'visible'
  };

  const sandbox = {
    document: documentMock,
    window: null,
    globalThis: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: (fn, ms) => {
      // In tests, synchronously or immediately execute to keep assertions fast
      const id = setTimeout(fn, ms);
      return id;
    },
    clearTimeout,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval,
    console,
    Date,
    Math,
    Boolean,
    String,
    Array,
    Object,
    JSON,
    sessionStorage: {
      _data: {},
      getItem(k) { return this._data[k] || null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);

  // Load appu-session.js
  const sessionCode = fs.readFileSync(path.resolve(__dirname, '../frontend/appu-session.js'), 'utf8');
  vm.runInContext(sessionCode, sandbox);

  // Load parental-controls-ui.js
  const controlsCode = fs.readFileSync(path.resolve(__dirname, '../frontend/parental-controls-ui.js'), 'utf8');
  vm.runInContext(controlsCode, sandbox);

  return {
    sandbox,
    elements,
    AppuSession: sandbox.AppuSession,
    ParentalControlsUI: sandbox.ParentalControlsUI
  };
}

describe('Phase A: Session-Start OTP Hard-Gate Suite', () => {
  let ctx;

  beforeEach(() => {
    ctx = createTestContext();
    ctx.ParentalControlsUI.init();
  });

  afterEach(() => {
    ctx.ParentalControlsUI.destroy();
    ctx.AppuSession.clear();
  });

  test('Anonymous / guest learner is never gated by session-start OTP', async () => {
    const { AppuSession, ParentalControlsUI, elements } = ctx;
    assert.equal(AppuSession.isAuthenticated(), false);

    let callbackExecuted = false;
    let requestOtpCalled = false;

    ctx.sandbox.AppuBackendClient = {
      requestSessionOtp: async () => {
        requestOtpCalled = true;
        return { requested: true };
      }
    };

    const allowed = await ParentalControlsUI.enforceSessionStartGate(() => {
      callbackExecuted = true;
    });

    assert.equal(allowed, true, 'Anonymous session must be allowed immediately without gate');
    assert.equal(requestOtpCalled, false, 'Backend requestSessionOtp must not be called for guests');
    assert.equal(ParentalControlsUI.isSessionStartGateActive, false);

    const modal = elements.get('parental-lock-modal');
    assert.equal(modal.classList.contains('is-visible'), false, 'Modal must remain hidden for guests');
  });

  test('Signed-in child first message attempt triggers OTP request and hard blocks message', async () => {
    const { AppuSession, ParentalControlsUI, elements } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });
    assert.equal(AppuSession.isAuthenticated(), true);
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), false);

    let requestPayload = null;
    ctx.sandbox.AppuBackendClient = {
      requestSessionOtp: async (params) => {
        requestPayload = params;
        return { requested: true };
      }
    };

    let callbackExecuted = false;
    const allowed = await ParentalControlsUI.enforceSessionStartGate(() => {
      callbackExecuted = true;
    });

    // Hard block
    assert.equal(allowed, false, 'First message attempt must return false to block sending');
    assert.equal(callbackExecuted, false, 'Pending message must NOT execute before parent OTP verification');
    assert.ok(requestPayload, 'requestSessionOtp must be called');
    assert.equal(requestPayload.childId, 'c1234567-0000-0000-0000-000000000001');
    assert.equal(requestPayload.accessToken, 'test_child_jwt_token');

    // UI Verification
    assert.equal(ParentalControlsUI.isSessionStartGateActive, true);
    const modal = elements.get('parental-lock-modal');
    assert.equal(modal.classList.contains('is-visible'), true, 'Parent lock modal must be visible');

    const verifyView = elements.get('lock-view-verify');
    assert.equal(verifyView.hidden, false, 'OTP verify view must be displayed');

    const statsCard = elements.get('parental-lock-stats');
    assert.equal(statsCard.style.display, 'none', '30-minute stats card must be hidden at session start');

    const title = elements.get('parental-lock-title');
    assert.ok(title.textContent.includes('Parent Verification Required'), 'Title must display session-start verification copy');

    const kicker = elements.get('modal-kicker');
    assert.ok(kicker.innerHTML.includes('Session Verification'), 'Kicker must indicate Session Verification');
  });

  test('Submitting valid OTP unlocks session, marks verified, and resumes stashed message', async () => {
    const { AppuSession, ParentalControlsUI, elements } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });

    let verifyPayload = null;
    ctx.sandbox.AppuBackendClient = {
      requestSessionOtp: async () => ({ requested: true }),
      verifySessionOtp: async (params) => {
        verifyPayload = params;
        return { verified: true };
      }
    };

    let callbackExecuted = false;
    await ParentalControlsUI.enforceSessionStartGate(() => {
      callbackExecuted = true;
    });

    assert.equal(callbackExecuted, false);
    assert.equal(ParentalControlsUI.isSessionStartGateActive, true);

    // Enter 6-digit code and submit
    const otpInput = elements.get('lock-otp-input');
    otpInput.value = '654321';

    const verifyBtn = elements.get('lock-btn-verify-otp');
    assert.ok(typeof verifyBtn.onclick === 'function');
    await verifyBtn.onclick();

    assert.ok(verifyPayload);
    assert.equal(verifyPayload.code, '654321');
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), true, 'isOtpVerifiedThisSession must be true');

    const successView = elements.get('lock-view-success');
    assert.equal(successView.hidden, false, 'Success view must be visible after verification');

    // Fast-forward timeout for resume callback
    await new Promise((resolve) => setTimeout(resolve, 1700));

    assert.equal(callbackExecuted, true, 'Stashed message callback must be invoked after verification');
    assert.equal(ParentalControlsUI.isSessionStartGateActive, false);
    const modal = elements.get('parental-lock-modal');
    assert.equal(modal.classList.contains('is-visible'), false, 'Modal must be closed after unlock');
  });

  test('Subsequent message attempts bypass gate immediately after OTP verification', async () => {
    const { AppuSession, ParentalControlsUI } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });

    ParentalControlsUI.setOtpVerifiedThisSession(true);

    let requestCount = 0;
    ctx.sandbox.AppuBackendClient = {
      requestSessionOtp: async () => {
        requestCount++;
        return { requested: true };
      }
    };

    let callbackRun = false;
    const allowed = await ParentalControlsUI.enforceSessionStartGate(() => {
      callbackRun = true;
    });

    assert.equal(allowed, true, 'Subsequent message must be allowed immediately');
    assert.equal(requestCount, 0, 'No OTP request should be made for already verified session');
  });

  test('Graceful skip: child is not locked out when parent has no phone or consent on file', async () => {
    const { AppuSession, ParentalControlsUI, elements } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });

    ctx.sandbox.AppuBackendClient = {
      requestSessionOtp: async () => {
        // Backend returns needsPhone: true when WhatsApp number or consent is missing
        return { requested: false, needsPhone: true };
      }
    };

    let callbackExecuted = false;
    const allowed = await ParentalControlsUI.enforceSessionStartGate(() => {
      callbackExecuted = true;
    });

    assert.equal(allowed, true, 'Gate must gracefully skip and allow chat when parent has no phone/consent');
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), true, 'Session marked verified to prevent repeated skips');
    assert.equal(ParentalControlsUI.isSessionStartGateActive, false);

    const modal = elements.get('parental-lock-modal');
    assert.equal(modal.classList.contains('is-visible'), false, 'Modal must NOT lock child out');
  });

  test('Graceful skip: child is not locked out when parental controls are disabled', async () => {
    const { AppuSession, ParentalControlsUI, elements } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });

    ctx.sandbox.AppuBackendClient = {
      requestSessionOtp: async () => {
        return { requested: false, error: 'parental_controls_disabled' };
      }
    };

    const allowed = await ParentalControlsUI.enforceSessionStartGate();
    assert.equal(allowed, true);
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), true);
    assert.equal(elements.get('parental-lock-modal').classList.contains('is-visible'), false);
  });

  test('30-minute study timer does not count down before session-start OTP is verified', async () => {
    const { AppuSession, ParentalControlsUI, elements } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });

    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), false);

    // Initial state
    assert.equal(ParentalControlsUI.timeRemainingSeconds, 1800);

    // Timer badge must be hidden for authed child before verification
    const timerBadge = elements.get('parental-timer-badge');
    assert.equal(timerBadge.hidden, true, 'Timer badge must be hidden until session-start OTP is verified');
  });

  test('AppuSession.clear and setSession reset otpVerifiedThisSession to false', () => {
    const { AppuSession, ParentalControlsUI } = ctx;

    ParentalControlsUI.setOtpVerifiedThisSession(true);
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), true);

    AppuSession.clear();
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), false, 'AppuSession.clear must reset otpVerifiedThisSession');

    ParentalControlsUI.setOtpVerifiedThisSession(true);
    AppuSession.setSession({
      accessToken: 'new_token',
      childId: 'new_child'
    });
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), false, 'AppuSession.setSession must reset otpVerifiedThisSession');
  });

  test('triggerLock restores 30-minute limit copy and unhides stats container', () => {
    const { ParentalControlsUI, elements } = ctx;

    ParentalControlsUI.triggerLock();
    assert.equal(ParentalControlsUI.isLocked, true);
    assert.equal(ParentalControlsUI.isSessionStartGateActive, false);

    const stats = elements.get('parental-lock-stats');
    assert.equal(stats.style.display, '', 'Stats must be visible on 30-minute lock');

    const title = elements.get('parental-lock-title');
    assert.ok(title.textContent.includes('Study Time Complete'), '30-minute lock copy must be restored');
  });

  test('tickActivity attributes activeMs when visible and awayMs when hidden and preserves wall-clock countdown', async () => {
    const { ParentalControlsUI, AppuSession } = ctx;

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });
    ParentalControlsUI.setOtpVerifiedThisSession(true);

    let recordedHeartbeats = [];
    ctx.sandbox.AppuBackendClient = {
      recordSessionHeartbeat: async (params) => {
        recordedHeartbeats.push(params);
        return { enabled: true, activeSeconds: 10, awaySeconds: 10, timeRemainingSeconds: 1780 };
      }
    };

    // 1. Visible tick -> active
    ctx.sandbox.document.visibilityState = 'visible';
    ParentalControlsUI.tickActivity();
    await ParentalControlsUI.sendHeartbeat();
    assert.ok(recordedHeartbeats.length > 0);
    const hb1 = recordedHeartbeats[recordedHeartbeats.length - 1];
    assert.equal(hb1.visibility, 'visible');

    // 2. Hidden tick -> away
    recordedHeartbeats = [];
    ctx.sandbox.document.visibilityState = 'hidden';
    ParentalControlsUI.tickActivity();
    await ParentalControlsUI.sendHeartbeat();
    assert.ok(recordedHeartbeats.length > 0);
    const hb2 = recordedHeartbeats[recordedHeartbeats.length - 1];
    assert.equal(hb2.visibility, 'hidden');
  });

  test('Production host (appuai.online): session-start OTP gate is disabled, timer ticks, and child is never blocked', async () => {
    const { ParentalControlsUI, AppuSession, elements } = ctx;

    // Simulate production host
    ctx.sandbox.window.location = { host: 'appuai.online' };

    assert.equal(ParentalControlsUI.isSessionStartOtpGateEnabled(), false, 'OTP gate must be disabled on prod host');

    AppuSession.setSession({
      accessToken: 'test_child_jwt_token',
      childId: 'c1234567-0000-0000-0000-000000000001'
    });
    assert.equal(AppuSession.isAuthenticated(), true);
    assert.equal(ParentalControlsUI.isOtpVerifiedThisSession(), false);

    // 1. enforceSessionStartGate must return true immediately
    let callbackCalled = false;
    const allowed = await ParentalControlsUI.enforceSessionStartGate(() => {
      callbackCalled = true;
    });
    assert.equal(allowed, true, 'On prod host, message must be allowed immediately without OTP gate');
    assert.equal(ParentalControlsUI.isSessionStartGateActive, false);
    const modal = elements.get('parental-lock-modal');
    assert.equal(modal.classList.contains('is-visible'), false, 'OTP modal must not open on prod');

    // 2. Timer must tick without requiring OTP
    ctx.sandbox.AppuBackendClient = {
      recordSessionHeartbeat: async () => ({
        enabled: true,
        activeSeconds: 60,
        awaySeconds: 0,
        timeRemainingSeconds: 1740
      })
    };
    await ParentalControlsUI.sendHeartbeat();
    assert.equal(ParentalControlsUI.isEnabled, true);

    const initialRemaining = ParentalControlsUI.timeRemainingSeconds;
    ParentalControlsUI.tickActivity();
    assert.ok(ParentalControlsUI.timeRemainingSeconds <= initialRemaining, 'Timer must tick down on prod without OTP');

    // 3. Timer badge must display on prod
    const timerBadge = elements.get('parental-timer-badge');
    assert.equal(timerBadge.hidden, false, 'Timer badge must be visible on prod');
  });

  test('Localhost/dev host: session-start OTP gate is enabled and experimentalLearning is active', () => {
    // 1. Config host gating
    const configCode = fs.readFileSync(path.resolve(__dirname, '../frontend/appu-config.js'), 'utf8');
    const sandboxDev = {
      window: { location: { host: 'localhost:3001' } },
      globalThis: {},
      setTimeout, clearTimeout
    };
    sandboxDev.globalThis = sandboxDev;
    vm.createContext(sandboxDev);
    vm.runInContext(configCode, sandboxDev);

    const devConfig = sandboxDev.APPU_CONFIG;
    assert.equal(devConfig.isDevHost(), true, 'localhost:3001 must be recognized as dev host');
    assert.equal(devConfig.experimentalLearning, true, 'experimentalLearning must be true on dev host');
    assert.equal(devConfig.sessionStartOtpGate, true, 'sessionStartOtpGate must be true on dev host');

    // 2. Prod config host gating
    const sandboxProd = {
      window: { location: { host: 'appuai.online' } },
      globalThis: {},
      setTimeout, clearTimeout
    };
    sandboxProd.globalThis = sandboxProd;
    vm.createContext(sandboxProd);
    vm.runInContext(configCode, sandboxProd);

    const prodConfig = sandboxProd.APPU_CONFIG;
    assert.equal(prodConfig.isDevHost(), false, 'appuai.online must NOT be recognized as dev host');
    assert.equal(prodConfig.experimentalLearning, false, 'experimentalLearning must be false on prod host');
    assert.equal(prodConfig.sessionStartOtpGate, false, 'sessionStartOtpGate must be false on prod host');
  });
});
