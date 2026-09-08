const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Setup minimal DOM mock
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
        return null;
      },
      querySelectorAll(sel) {
        return [];
      },
      addEventListener(evt, handler) {
        const key = `${el.id || el.className}:${evt}`;
        const list = listeners.get(key) || [];
        list.push(handler);
        listeners.set(key, list);
      },
      async dispatchEvent(evt) {
        const key = `${el.id || el.className}:${evt.type}`;
        const list = listeners.get(key) || [];
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
    'pos-child-nickname',
    'pos-child-nickname-label',
    'pos-child-dob',
    'pos-child-dob-label',
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
    location: { origin: 'https://appuai.online' },
    requestAnimationFrame(fn) { fn(); }
  };

  return { elements, listeners };
}

describe('Personalisation Step 4 Nickname & DOB UI (Phase-B Task 4)', () => {
  const frontendDir = path.resolve(__dirname, '../frontend');

  test('Case 1: DOM fields present in index.html inside #pos-pers-form', () => {
    const html = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');

    // #pos-child-nickname with maxlength="50"
    assert.match(
      html,
      /<input[^>]*id=["']pos-child-nickname["'][^>]*maxlength=["']50["']|<input[^>]*maxlength=["']50["'][^>]*id=["']pos-child-nickname["']/i,
      'index.html must contain #pos-child-nickname with maxlength="50"'
    );

    // #pos-child-dob with type="date"
    assert.match(
      html,
      /<input[^>]*id=["']pos-child-dob["'][^>]*type=["']date["']|<input[^>]*type=["']date["'][^>]*id=["']pos-child-dob["']/i,
      'index.html must contain #pos-child-dob with type="date"'
    );

    // Labels must exist
    assert.ok(html.includes('id="pos-child-nickname-label"'), 'Must contain #pos-child-nickname-label');
    assert.ok(html.includes('id="pos-child-dob-label"'), 'Must contain #pos-child-dob-label');
  });

  describe('Client-Side Behavior & Form Handling', () => {
    let dom;
    let savedData;
    let ParentSetupUI;

    beforeEach(() => {
      dom = setupDomMock();
      savedData = null;

      global.window.ParentOnboardingShell = {
        state: {
          session: { access_token: 'fake-jwt' },
          selectedChild: { id: 'child-123', preferredName: 'Aarav' }
        },
        async fetchPersonalisation() {
          return null;
        },
        async savePersonalisation(childId, data) {
          savedData = { childId, data };
          return data;
        },
        launchAppuSession() {}
      };

      delete require.cache[require.resolve('../frontend/parent-setup-ui.js')];
      ParentSetupUI = require('../frontend/parent-setup-ui.js');
      ParentSetupUI.init();
    });

    test('Case 2: renderPersonalisationStep prefills nickname and dob from child record', async () => {
      const childWithData = {
        id: 'child-123',
        preferredName: 'Aarav',
        nickname: 'Aavu',
        dob: '2014-06-15'
      };

      global.window.ParentOnboardingShell.state.selectedChild = childWithData;

      const nicknameInput = dom.elements.get('pos-child-nickname');
      const dobInput = dom.elements.get('pos-child-dob');

      ParentSetupUI.openModal(4);

      assert.equal(nicknameInput.value, 'Aavu');
      assert.equal(dobInput.value, '2014-06-15');
    });

    test('Case 3: Form submission rejects future or out-of-range DOB with alert', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const dobInput = dom.elements.get('pos-child-dob');
      const alertBox = dom.elements.get('pos-alert');

      // 1. Future date
      dobInput.value = '2030-01-01';
      await persForm.dispatchEvent({ type: 'submit', preventDefault() {} });
      assert.equal(savedData, null, 'Future date must not submit');
      assert.equal(alertBox.style.display, 'block');

      // 2. Age < 3
      savedData = null;
      dobInput.value = '2025-06-01';
      await persForm.dispatchEvent({ type: 'submit', preventDefault() {} });
      assert.equal(savedData, null, 'Age under 3 must not submit');
      assert.equal(alertBox.style.display, 'block');

      // 3. Age > 25
      savedData = null;
      dobInput.value = '1990-01-01';
      await persForm.dispatchEvent({ type: 'submit', preventDefault() {} });
      assert.equal(savedData, null, 'Age over 25 must not submit');
      assert.equal(alertBox.style.display, 'block');

      // 4. Invalid calendar date (Feb 31)
      savedData = null;
      dobInput.value = '2015-02-31';
      await persForm.dispatchEvent({ type: 'submit', preventDefault() {} });
      assert.equal(savedData, null, 'Invalid calendar date must not submit');
      assert.equal(alertBox.style.display, 'block');
    });

    test('Case 4: Form submission submits nickname and dob in payload and updates in-memory child', async () => {
      const persForm = dom.elements.get('pos-pers-form');
      const nicknameInput = dom.elements.get('pos-child-nickname');
      const dobInput = dom.elements.get('pos-child-dob');

      nicknameInput.value = 'Aavu';
      dobInput.value = '2014-06-15';

      await persForm.dispatchEvent({ type: 'submit', preventDefault() {} });

      assert.ok(savedData, 'savePersonalisation must be called');
      assert.equal(savedData.data.nickname, 'Aavu');
      assert.equal(savedData.data.dob, '2014-06-15');

      const selectedChild = global.window.ParentOnboardingShell.state.selectedChild;
      assert.equal(selectedChild.nickname, 'Aavu');
      assert.equal(selectedChild.dob, '2014-06-15');

      // Now clear them
      savedData = null;
      nicknameInput.value = '';
      dobInput.value = '';

      await persForm.dispatchEvent({ type: 'submit', preventDefault() {} });
      assert.ok(savedData, 'savePersonalisation must be called when clearing');
      assert.equal(savedData.data.nickname, null);
      assert.equal(savedData.data.dob, null);
      assert.equal(selectedChild.nickname, null);
      assert.equal(selectedChild.dob, null);
    });
  });

  test('Case 5: Translations for posChildNicknameLabel, posChildDobLabel, and dobAgeInvalidAlert exist in en, kn, hi in app.js', () => {
    const appJs = fs.readFileSync(path.join(frontendDir, 'app.js'), 'utf8');

    ['en', 'kn', 'hi'].forEach((lang) => {
      assert.ok(
        appJs.includes('posChildNicknameLabel'),
        `app.js must contain posChildNicknameLabel`
      );
      assert.ok(
        appJs.includes('posChildDobLabel'),
        `app.js must contain posChildDobLabel`
      );
      assert.ok(
        appJs.includes('dobAgeInvalidAlert'),
        `app.js must contain dobAgeInvalidAlert`
      );
    });
  });

  test('Case 6: Document preserves exactly one <h1> tag in index.html', () => {
    const html = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
    const h1Matches = html.match(/<h1(\s|>)/gi);
    assert.equal(h1Matches ? h1Matches.length : 0, 1, 'index.html must have exactly one <h1>');
  });
});
