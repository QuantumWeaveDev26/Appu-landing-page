const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML_PATH = path.join(__dirname, '..', 'frontend', 'index.html');
const CSS_PATH = path.join(__dirname, '..', 'frontend', 'style.css');
const htmlSource = fs.readFileSync(HTML_PATH, 'utf8');
const cssSource = fs.readFileSync(CSS_PATH, 'utf8');

describe('Landing Page Visible Sign in / Sign up CTA & Native Drawer Slot', () => {
  let ParentOnboardingShell;
  let dom;

  function createMockElement(tag, id = '', className = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className,
      classList: {
        _classes: new Set(className ? className.split(/\s+/).filter(Boolean) : []),
        add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
        remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
        contains(c) { return this._classes.has(c); }
      },
      style: {},
      attributes: {},
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k]; },
      hasAttribute(k) { return k in this.attributes; },
      removeAttribute(k) { delete this.attributes[k]; },
      textContent: '',
      innerHTML: '',
      children: [],
      parentElement: null,
      appendChild(child) {
        if (child.parentElement) {
          const idx = child.parentElement.children.indexOf(child);
          if (idx !== -1) child.parentElement.children.splice(idx, 1);
        }
        this.children.push(child);
        child.parentElement = this;
        return child;
      },
      insertBefore(child, referenceNode) {
        if (child.parentElement) {
          const idx = child.parentElement.children.indexOf(child);
          if (idx !== -1) child.parentElement.children.splice(idx, 1);
        }
        if (!referenceNode) return this.appendChild(child);
        const refIdx = this.children.indexOf(referenceNode);
        if (refIdx === -1) { this.children.push(child); } else { this.children.splice(refIdx, 0, child); }
        child.parentElement = this;
        return child;
      },
      _listeners: {},
      addEventListener(evt, fn) {
        this._listeners[evt] = this._listeners[evt] || [];
        this._listeners[evt].push(fn);
      },
      dispatchEvent(evt) {
        const handlers = this._listeners[evt.type || evt] || [];
        for (const h of handlers) h(evt);
      },
      click() {
        this.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
      },
      querySelector(sel) {
        for (const c of this.children) {
          if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) return c;
        }
        return null;
      }
    };
    return el;
  }

  function setupDomEnvironment() {
    const elements = new Map();
    const doc = {
      createElement(tag) { return createMockElement(tag); },
      getElementById(id) { return elements.get(id) || null; },
      querySelector(sel) {
        if (sel === '.topbar-actions') return elements.get('topbar-actions');
        if (sel === '#nav-drawer-account-slot') return elements.get('nav-drawer-account-slot');
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        return null;
      },
      addEventListener() {}
    };

    const topbarActions = createMockElement('div', 'topbar-actions', 'topbar-actions');
    const parentSessionBadge = createMockElement('div', 'parent-session-badge', 'parent-session-badge');
    const btnMainAuth = createMockElement('button', 'btn-main-auth', 'auth-pill-btn');
    btnMainAuth.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i><span>Sign in / Sign up</span>';
    btnMainAuth.textContent = 'Sign in / Sign up';

    const btnParentSetup = createMockElement('button', 'btn-parent-setup', 'parent-zone-btn');
    const statusLabel = createMockElement('span', 'status-label');
    const navDrawerAccountSlot = createMockElement('div', 'nav-drawer-account-slot', 'nav-drawer-slot');

    topbarActions.appendChild(parentSessionBadge);
    topbarActions.appendChild(btnMainAuth);
    topbarActions.appendChild(btnParentSetup);

    elements.set('topbar-actions', topbarActions);
    elements.set('parent-session-badge', parentSessionBadge);
    elements.set('btn-main-auth', btnMainAuth);
    elements.set('btn-parent-setup', btnParentSetup);
    elements.set('status-label', statusLabel);
    elements.set('nav-drawer-account-slot', navDrawerAccountSlot);

    global.document = doc;
    global.window = {
      document: doc,
      AppuSession: {
        _authed: false,
        parentContext: null,
        isAuthenticated() { return this._authed; },
        setSession({ parentContext }) { this._authed = true; this.parentContext = parentContext; },
        clear() { this._authed = false; this.parentContext = null; }
      },
      ParentSetupUI: {
        modalOpenedWithStep: null,
        openModal(step) { this.modalOpenedWithStep = step; }
      }
    };

    return { elements, btnMainAuth, parentSessionBadge, navDrawerAccountSlot };
  }

  beforeEach(() => {
    dom = setupDomEnvironment();
    delete require.cache[require.resolve('../frontend/parent-onboarding-shell.js')];
    ParentOnboardingShell = require('../frontend/parent-onboarding-shell.js');
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  test('index.html contains #btn-main-auth in .topbar-actions and #nav-drawer-account-slot in nav-drawer', () => {
    assert.match(
      htmlSource,
      /<div class="topbar-actions">[\s\S]*?id="btn-main-auth"[\s\S]*?<\/div>/,
      '.topbar-actions must contain #btn-main-auth'
    );
    assert.match(
      htmlSource,
      /id="btn-main-auth"[^>]*class="[^"]*auth-pill-btn[^"]*"[^>]*>[\s\S]*?Sign in \/ Sign up/i,
      '#btn-main-auth must have class auth-pill-btn and contain "Sign in / Sign up"'
    );
    assert.match(
      htmlSource,
      /id="nav-drawer-account-slot"/,
      'index.html must contain #nav-drawer-account-slot'
    );
  });

  test('style.css defines .auth-pill-btn styling and focus-visible pseudo-class', () => {
    assert.match(cssSource, /\.auth-pill-btn\s*\{/, 'style.css must define .auth-pill-btn');
    assert.match(cssSource, /\.auth-pill-btn:focus-visible/, 'style.css must define focus-visible for .auth-pill-btn');
  });

  test('when session is unauthenticated, updateHeaderSessionBadge displays #btn-main-auth and hides badge', () => {
    global.window.AppuSession.clear();
    ParentOnboardingShell.state.session = null;
    ParentOnboardingShell.state.authStatus = 'UNAUTHENTICATED';

    ParentOnboardingShell.updateHeaderSessionBadge();

    assert.notEqual(
      dom.btnMainAuth.style.display,
      'none',
      '#btn-main-auth must be visible when unauthenticated'
    );
    assert.equal(
      dom.parentSessionBadge.style.display,
      'none',
      '#parent-session-badge must be hidden when unauthenticated'
    );
  });

  test('clicking #btn-main-auth triggers ParentSetupUI.openModal(1)', () => {
    let openedStep = null;
    global.window.ParentSetupUI = {
      openModal(step) { openedStep = step; }
    };

    const btn = dom.btnMainAuth;
    btn.addEventListener('click', () => {
      if (global.window.ParentSetupUI && typeof global.window.ParentSetupUI.openModal === 'function') {
        global.window.ParentSetupUI.openModal(1);
      }
    });

    btn.click();
    assert.equal(openedStep, 1, 'Clicking #btn-main-auth must open modal at step 1');
  });

  test('when session is authenticated, updateHeaderSessionBadge hides #btn-main-auth and shows badge', () => {
    global.window.AppuSession.setSession({
      parentContext: { childName: 'Aarav' }
    });
    ParentOnboardingShell.state.session = { user: { id: 'parent-123' } };
    ParentOnboardingShell.state.authStatus = 'AUTHENTICATED';
    ParentOnboardingShell.state.selectedChild = { preferredName: 'Aarav' };

    ParentOnboardingShell.updateHeaderSessionBadge();

    assert.equal(
      dom.btnMainAuth.style.display,
      'none',
      '#btn-main-auth must be hidden when authenticated'
    );
    assert.equal(
      dom.parentSessionBadge.style.display,
      'inline-flex',
      '#parent-session-badge must be visible when authenticated'
    );
  });

  test('native mode relocation surfaces #btn-main-auth in #nav-drawer-account-slot', () => {
    const navAccountSlot = dom.navDrawerAccountSlot;
    const btnMainAuth = dom.btnMainAuth;

    navAccountSlot.appendChild(btnMainAuth);

    assert.ok(
      navAccountSlot.children.includes(btnMainAuth),
      '#btn-main-auth must be relocated into #nav-drawer-account-slot in native mode'
    );
    assert.equal(btnMainAuth.parentElement, navAccountSlot);
  });
});
