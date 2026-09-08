const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const APP_JS_PATH = path.join(__dirname, '..', 'frontend', 'app.js');
const appJsSource = fs.readFileSync(APP_JS_PATH, 'utf8');

describe('Nav Drawer i18n & Multi-Language Translation (kn, hi, en)', () => {
  let dom;
  let applyUiTranslations;
  let UI_TRANSLATIONS;

  function createMockElement(tag, id = '', className = '', attrs = {}) {
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
      style: {},
      attributes: { ...attrs },
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; },
      hasAttribute(k) { return k in this.attributes; },
      removeAttribute(k) { delete this.attributes[k]; },
      textContent: '',
      innerHTML: '',
      children: [],
      parentElement: null,
      appendChild(child) {
        this.children.push(child);
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
      querySelector(sel) {
        for (const c of this.children) {
          if (sel === 'small' && c.tagName === 'SMALL') return c;
          if (sel === 'span' && c.tagName === 'SPAN') return c;
          if (sel.startsWith('.') && c.classList.contains(sel.slice(1))) return c;
          if (sel.startsWith('#') && c.id === sel.slice(1)) return c;
          if (sel.includes('a[href*=')) {
            const match = sel.match(/href\*="([^"]+)"/);
            if (match && c.tagName === 'A' && (c.getAttribute('href') || '').includes(match[1])) {
              return c;
            }
          }
          const nested = c.querySelector(sel);
          if (nested) return nested;
        }
        return null;
      },
      querySelectorAll(sel) {
        const results = [];
        for (const c of this.children) {
          if (sel === 'small' && c.tagName === 'SMALL') results.push(c);
          if (sel === 'span' && c.tagName === 'SPAN') results.push(c);
          results.push(...c.querySelectorAll(sel));
        }
        return results;
      }
    };
    return el;
  }

  function setupDomEnvironment() {
    const elements = new Map();

    const drawerTitle = createMockElement('span', 'nav-drawer-title', 'nav-drawer-brand-copy');
    const drawerTitleSmall = createMockElement('small');
    drawerTitleSmall.textContent = 'Learn with Appu';
    drawerTitle.appendChild(drawerTitleSmall);

    const btnCloseNavDrawer = createMockElement('button', 'btn-close-nav-drawer', 'icon-btn close-btn', { 'aria-label': 'Close menu' });

    const btnQuickSchedule = createMockElement('button', 'btn-quick-schedule', 'icon-btn', {
      'aria-label': 'Schedule support call',
      'title': 'Schedule Support Call'
    });
    const quickScheduleSpan = createMockElement('span');
    quickScheduleSpan.textContent = 'Schedule Support Call';
    btnQuickSchedule.appendChild(quickScheduleSpan);

    const btnSoundToggle = createMockElement('button', 'btn-sound-toggle', 'icon-btn', { 'aria-label': 'Toggle sound effects' });
    const soundToggleSpan = createMockElement('span');
    soundToggleSpan.textContent = 'Sound Effects';
    btnSoundToggle.appendChild(soundToggleSpan);

    const navDrawerLegal = createMockElement('div', '', 'nav-drawer-legal');
    const legalLinks = [
      { href: 'privacy-policy.html', text: 'Privacy Policy' },
      { href: 'terms-and-conditions.html', text: 'Terms & Conditions' },
      { href: 'cancellation-refund-policy.html', text: 'Cancellation & Refunds' },
      { href: 'shipping-delivery-policy.html', text: 'Shipping & Delivery' },
      { href: 'pricing.html', text: 'Pricing' },
      { href: 'contact-us.html', text: 'Contact Us' }
    ];
    for (const l of legalLinks) {
      const a = createMockElement('a', '', '', { href: l.href });
      a.textContent = l.text;
      navDrawerLegal.appendChild(a);
    }

    elements.set('nav-drawer-title', drawerTitle);
    elements.set('btn-close-nav-drawer', btnCloseNavDrawer);
    elements.set('btn-quick-schedule', btnQuickSchedule);
    elements.set('btn-sound-toggle', btnSoundToggle);

    const doc = {
      documentElement: { lang: 'en' },
      getElementById(id) {
        return elements.get(id) || null;
      },
      querySelector(sel) {
        if (sel === '#nav-drawer-title small') return drawerTitleSmall;
        if (sel === '#btn-close-nav-drawer') return btnCloseNavDrawer;
        if (sel === '#btn-quick-schedule') return btnQuickSchedule;
        if (sel === '#btn-sound-toggle') return btnSoundToggle;
        if (sel.startsWith('.nav-drawer-legal a[href*=')) {
          return navDrawerLegal.querySelector(sel.replace('.nav-drawer-legal ', ''));
        }
        if (sel === '.nav-drawer-legal') return navDrawerLegal;
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        return null;
      },
      querySelectorAll(sel) {
        return [];
      },
      addEventListener() {}
    };

    global.document = doc;
    global.window = {
      document: doc,
      localStorage: {
        _d: {},
        getItem(k) { return this._d[k] || null; },
        setItem(k, v) { this._d[k] = String(v); }
      }
    };

    return {
      elements,
      drawerTitleSmall,
      btnCloseNavDrawer,
      btnQuickSchedule,
      quickScheduleSpan,
      btnSoundToggle,
      soundToggleSpan,
      navDrawerLegal
    };
  }

  beforeEach(() => {
    dom = setupDomEnvironment();
    // Parse UI_TRANSLATIONS directly from app.js using regex or VM
    const matchTranslations = appJsSource.match(/const\s+UI_TRANSLATIONS\s*=\s*(\{[\s\S]*?\n\s{2}\};)/);
    if (matchTranslations) {
      UI_TRANSLATIONS = (new Function(`return ${matchTranslations[1]}`))();
    } else {
      UI_TRANSLATIONS = null;
    }

    // Isolate applyUiTranslations function
    const matchApply = appJsSource.match(/(function\s+applyUiTranslations\s*\([\s\S]*?\n\s{2}\})/);
    if (matchApply && UI_TRANSLATIONS) {
      const wrapped = new Function('UI_TRANSLATIONS', 'document', 'window', `
        ${matchApply[1]}
        return applyUiTranslations;
      `);
      applyUiTranslations = wrapped(UI_TRANSLATIONS, global.document, global.window);
    } else {
      applyUiTranslations = null;
    }
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  test('UI_TRANSLATIONS defines all 10 drawer translation keys for en, kn, and hi', () => {
    assert.ok(UI_TRANSLATIONS, 'UI_TRANSLATIONS must be defined in app.js');

    const requiredKeys = [
      'drawerLearnWithAppu',
      'drawerCloseMenu',
      'drawerScheduleCall',
      'drawerSoundEffects',
      'drawerPrivacy',
      'drawerTerms',
      'drawerCancellation',
      'drawerShipping',
      'drawerPricing',
      'drawerContact'
    ];

    for (const lang of ['en', 'kn', 'hi']) {
      assert.ok(UI_TRANSLATIONS[lang], `UI_TRANSLATIONS must have language '${lang}'`);
      for (const key of requiredKeys) {
        assert.ok(
          UI_TRANSLATIONS[lang][key] && UI_TRANSLATIONS[lang][key].trim().length > 0,
          `UI_TRANSLATIONS.${lang}.${key} must be non-empty`
        );
      }
    }

    // Verify accurate Kannada & Hindi content
    assert.equal(UI_TRANSLATIONS.kn.drawerLearnWithAppu, 'ಅಪ್ಪುವಿನೊಂದಿಗೆ ಕಲಿಯಿರಿ');
    assert.equal(UI_TRANSLATIONS.hi.drawerLearnWithAppu, 'अप्पू के साथ सीखें');
    assert.equal(UI_TRANSLATIONS.kn.drawerCloseMenu, 'ಮೆನು ಮುಚ್ಚಿ');
    assert.equal(UI_TRANSLATIONS.hi.drawerCloseMenu, 'मेनू बंद करें');
    assert.equal(UI_TRANSLATIONS.kn.drawerPrivacy, 'ಗೌಪ್ಯತಾ ನೀತಿ');
    assert.equal(UI_TRANSLATIONS.hi.drawerPrivacy, 'गोपनीयता नीति');
  });

  test('applyUiTranslations(kn) translates all drawer elements into Kannada', () => {
    assert.ok(applyUiTranslations, 'applyUiTranslations function must be accessible');
    applyUiTranslations('kn');

    assert.equal(dom.drawerTitleSmall.textContent, 'ಅಪ್ಪುವಿನೊಂದಿಗೆ ಕಲಿಯಿರಿ');
    assert.equal(dom.btnCloseNavDrawer.getAttribute('aria-label'), 'ಮೆನು ಮುಚ್ಚಿ');
    assert.equal(dom.quickScheduleSpan.textContent, 'ಬೆಂಬಲ ಕರೆ ನಿಗದಿಪಡಿಸಿ');
    assert.equal(dom.btnQuickSchedule.getAttribute('title'), 'ಬೆಂಬಲ ಕರೆ ನಿಗದಿಪಡಿಸಿ');
    assert.equal(dom.soundToggleSpan.textContent, 'ಧ್ವನಿ ಪರಿಣಾಮಗಳು');

    const legal = dom.navDrawerLegal;
    const privacy = legal.querySelector('a[href*="privacy-policy"]');
    const terms = legal.querySelector('a[href*="terms-and-conditions"]');
    const cancellation = legal.querySelector('a[href*="cancellation-refund-policy"]');
    const shipping = legal.querySelector('a[href*="shipping-delivery-policy"]');
    const pricing = legal.querySelector('a[href*="pricing"]');
    const contact = legal.querySelector('a[href*="contact-us"]');

    assert.equal(privacy.textContent, 'ಗೌಪ್ಯತಾ ನೀತಿ');
    assert.equal(terms.textContent, 'ನಿಯಮಗಳು ಮತ್ತು ಷರತ್ತುಗಳು');
    assert.equal(cancellation.textContent, 'ರದ್ದತಿ ಮತ್ತು ಮರುಪಾವತಿ');
    assert.equal(shipping.textContent, 'ರವಾನೆ ಮತ್ತು ವಿತರಣೆ');
    assert.equal(pricing.textContent, 'ದರ ವಿವರ');
    assert.equal(contact.textContent, 'ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿ');
  });

  test('applyUiTranslations(hi) translates all drawer elements into Hindi', () => {
    assert.ok(applyUiTranslations, 'applyUiTranslations function must be accessible');
    applyUiTranslations('hi');

    assert.equal(dom.drawerTitleSmall.textContent, 'अप्पू के साथ सीखें');
    assert.equal(dom.btnCloseNavDrawer.getAttribute('aria-label'), 'मेनू बंद करें');
    assert.equal(dom.quickScheduleSpan.textContent, 'सहायता कॉल बुक करें');
    assert.equal(dom.btnQuickSchedule.getAttribute('title'), 'सहायता कॉल बुक करें');
    assert.equal(dom.soundToggleSpan.textContent, 'ध्वनि प्रभाव');

    const legal = dom.navDrawerLegal;
    const privacy = legal.querySelector('a[href*="privacy-policy"]');
    const terms = legal.querySelector('a[href*="terms-and-conditions"]');
    const cancellation = legal.querySelector('a[href*="cancellation-refund-policy"]');
    const shipping = legal.querySelector('a[href*="shipping-delivery-policy"]');
    const pricing = legal.querySelector('a[href*="pricing"]');
    const contact = legal.querySelector('a[href*="contact-us"]');

    assert.equal(privacy.textContent, 'गोपनीयता नीति');
    assert.equal(terms.textContent, 'नियम और शर्तें');
    assert.equal(cancellation.textContent, 'रद्दीकरण और रिफंड');
    assert.equal(shipping.textContent, 'शिपिंग और डिलीवरी');
    assert.equal(pricing.textContent, 'मूल्य निर्धारण');
    assert.equal(contact.textContent, 'संपर्क करें');
  });

  test('applyUiTranslations(en) restores all drawer elements to English', () => {
    assert.ok(applyUiTranslations, 'applyUiTranslations function must be accessible');
    // First translate to kn, then restore to en
    applyUiTranslations('kn');
    applyUiTranslations('en');

    assert.equal(dom.drawerTitleSmall.textContent, 'Learn with Appu');
    assert.equal(dom.btnCloseNavDrawer.getAttribute('aria-label'), 'Close menu');
    assert.equal(dom.quickScheduleSpan.textContent, 'Schedule Support Call');
    assert.equal(dom.soundToggleSpan.textContent, 'Sound Effects');

    const legal = dom.navDrawerLegal;
    assert.equal(legal.querySelector('a[href*="privacy-policy"]').textContent, 'Privacy Policy');
    assert.equal(legal.querySelector('a[href*="terms-and-conditions"]').textContent, 'Terms & Conditions');
    assert.equal(legal.querySelector('a[href*="cancellation-refund-policy"]').textContent, 'Cancellation & Refunds');
    assert.equal(legal.querySelector('a[href*="shipping-delivery-policy"]').textContent, 'Shipping & Delivery');
    assert.equal(legal.querySelector('a[href*="pricing"]').textContent, 'Pricing');
    assert.equal(legal.querySelector('a[href*="contact-us"]').textContent, 'Contact Us');
  });
});
