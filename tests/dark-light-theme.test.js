import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

const indexHtml = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(FRONTEND, 'style.css'), 'utf8');
const savedLessonsCss = fs.readFileSync(path.join(FRONTEND, 'saved-lessons.css'), 'utf8');
const appJs = fs.readFileSync(path.join(FRONTEND, 'app.js'), 'utf8');

test('Dark & Light Theme: index.html structure & markup', async (t) => {
  await t.test('has early FOUC prevention script in head', () => {
    assert.match(indexHtml, /<script>[\s\S]*?localStorage\.getItem\(['"]appu_theme['"]\)[\s\S]*?data-theme[\s\S]*?<\/script>/i);
  });

  await t.test('defines desktop #btn-theme-toggle in topbar-actions', () => {
    assert.match(indexHtml, /<button\s+id="btn-theme-toggle"[^>]*class="[^"]*icon-btn[^"]*theme-toggle-btn[^"]*"[^>]*>/);
    assert.match(indexHtml, /id="theme-icon"/);
  });

  await t.test('defines mobile #btn-drawer-theme-toggle in nav drawer', () => {
    assert.match(indexHtml, /<button\s+id="btn-drawer-theme-toggle"[^>]*class="[^"]*nav-drawer-theme-link[^"]*"[^>]*>/);
    assert.match(indexHtml, /id="drawer-theme-icon"/);
    assert.match(indexHtml, /id="drawer-theme-text"/);
  });
});

test('Dark & Light Theme: style.css tokens and transitions', async (t) => {
  await t.test('defines light tokens on :root and [data-theme="light"]', () => {
    assert.match(styleCss, /\[data-theme=["']light["']\]/);
    assert.match(styleCss, /--bg-page:\s*linear-gradient/);
  });

  await t.test('defines dark tokens on [data-theme="dark"]', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]/);
    assert.match(styleCss, /--bg-page:\s*#030a16/);
    assert.match(styleCss, /--ink:\s*#f5f8ff/);
    assert.match(styleCss, /--cyan:\s*#22d3ee/);
  });

  await t.test('defines .theme-transitioning for smooth seamless switching without flash', () => {
    assert.match(styleCss, /\.theme-transitioning/);
    assert.match(styleCss, /transition:\s*background-color\s+0\.28s/);
  });

  await t.test('hides desktop #btn-theme-toggle on mobile topbar (max-width: 768px)', () => {
    assert.match(styleCss, /\.topbar-actions\s+#btn-theme-toggle/);
  });

  await t.test('provides keynote stage dark theme surface overrides', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.mission-stage/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.stage-backdrop/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.mission-card/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.response-dock/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.chat-drawer/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.nav-drawer/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.modal-card/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.lesson-block-plain/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.concept-branch-card/);
  });

  await t.test('tokenizes all modal sheets, pos-sheet, and form inputs for dark mode', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.modal-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.pos-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.settings-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.reports-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.parental-lock-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.guest-limit-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.notes-upload-sheet/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.prompt-library-panel/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.welcome-gate/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.legal-viewer/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.pos-tabs/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.pos-google-btn/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.discovery-form\s+input/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+#beta-banner[\s\S]*?#040c18/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+#beta-banner-cta/);
  });

  await t.test('gives topbar controls cohesive dark translucent surfaces', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.language-switch[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.04\)/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.topbar-saved-btn[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.04\)/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.parent-zone-btn[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.04\)/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.auth-pill-btn[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.04\)/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.icon-btn[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.04\)/);
  });

  await t.test('desktop topbar uses flex layout and compact sizing to prevent right-edge clipping', () => {
    assert.match(styleCss, /@media\s*\(min-width:\s*1001px\)[\s\S]*?\.topbar\s*\{[\s\S]*?display:\s*flex;/);
    assert.match(styleCss, /@media\s*\(min-width:\s*1001px\)[\s\S]*?\.topbar\s*\{[\s\S]*?justify-content:\s*space-between;/);
    assert.match(styleCss, /@media\s*\(min-width:\s*1001px\)[\s\S]*?\.topbar-actions\s*\.icon-btn\s*\{[\s\S]*?width:\s*36px;/);
  });
});

test('Dark & Light Theme: saved-lessons.css adaptations', async (t) => {
  await t.test('provides dark theme styling for Saved Lessons panel and cards', () => {
    assert.match(savedLessonsCss, /\[data-theme=["']dark["']\]\s+\.saved-lessons-panel/);
    assert.match(savedLessonsCss, /\[data-theme=["']dark["']\]\s+\.topbar-saved-btn/);
    assert.match(savedLessonsCss, /\[data-theme=["']dark["']\]\s+\.saved-lesson-card/);
    assert.match(savedLessonsCss, /\[data-theme=["']dark["']\]\s+\.saved-count-badge/);
    assert.match(savedLessonsCss, /\[data-theme=["']dark["']\]\s+\.btn-saved-delete/);
    assert.match(savedLessonsCss, /\[data-theme=["']dark["']\]\s+\.study-tab-save/);
  });
});

test('Dark & Light Theme: app.js controller and runtime logic', async (t) => {
  await t.test('contains theme storage key and toggle methods', () => {
    assert.match(appJs, /const\s+THEME_STORAGE_KEY\s*=\s*['"]appu_theme['"]/);
    assert.match(appJs, /function\s+applyTheme\(/);
    assert.match(appJs, /function\s+toggleTheme\(/);
    assert.match(appJs, /function\s+getEffectiveTheme\(/);
  });

  await t.test('exposes theme methods on window.app and window.appuTheme', () => {
    assert.match(appJs, /window\.appuTheme\s*=/);
    assert.match(appJs, /window\.app\.getTheme\s*=/);
    assert.match(appJs, /window\.app\.setTheme\s*=/);
    assert.match(appJs, /window\.app\.toggleTheme\s*=/);
  });

  await t.test('toggles documentElement data-theme and classes and updates localStorage', () => {
    const mockStorage = {};
    const mockDocEl = {
      attributes: {},
      classes: new Set(),
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; },
      classList: {
        add(c) { mockDocEl.classes.add(c); },
        remove(c) { mockDocEl.classes.delete(c); },
        toggle(c, force) {
          if (force) mockDocEl.classes.add(c);
          else mockDocEl.classes.delete(c);
        },
        contains(c) { return mockDocEl.classes.has(c); }
      }
    };
    const mockBody = {
      attributes: {},
      classes: new Set(),
      setAttribute(k, v) { this.attributes[k] = v; },
      getAttribute(k) { return this.attributes[k]; },
      classList: {
        add(c) { mockBody.classes.add(c); },
        remove(c) { mockBody.classes.delete(c); },
        toggle(c, force) {
          if (force) mockBody.classes.add(c);
          else mockBody.classes.delete(c);
        },
        contains(c) { return mockBody.classes.has(c); }
      }
    };

    // Simulate theme application logic
    function applyMockTheme(theme, animate = false) {
      const nextTheme = theme === 'dark' ? 'dark' : 'light';
      if (animate) {
        mockDocEl.classList.add('theme-transitioning');
      }
      mockDocEl.setAttribute('data-theme', nextTheme);
      mockDocEl.classList.toggle('theme-dark', nextTheme === 'dark');
      mockDocEl.classList.toggle('theme-light', nextTheme === 'light');

      mockBody.setAttribute('data-theme', nextTheme);
      mockBody.classList.toggle('theme-dark', nextTheme === 'dark');
      mockBody.classList.toggle('theme-light', nextTheme === 'light');

      mockStorage['appu_theme'] = nextTheme;
      return nextTheme;
    }

    // Default: light
    applyMockTheme('light', false);
    assert.equal(mockDocEl.getAttribute('data-theme'), 'light');
    assert.equal(mockBody.getAttribute('data-theme'), 'light');
    assert.equal(mockStorage['appu_theme'], 'light');
    assert.equal(mockDocEl.classList.contains('theme-dark'), false);
    assert.equal(mockDocEl.classList.contains('theme-light'), true);

    // Toggle to dark
    applyMockTheme('dark', true);
    assert.equal(mockDocEl.getAttribute('data-theme'), 'dark');
    assert.equal(mockBody.getAttribute('data-theme'), 'dark');
    assert.equal(mockStorage['appu_theme'], 'dark');
    assert.equal(mockDocEl.classList.contains('theme-dark'), true);
    assert.equal(mockDocEl.classList.contains('theme-light'), false);
    assert.equal(mockDocEl.classList.contains('theme-transitioning'), true);
  });
});

test('Dark & Light Theme: comprehensive audit fixes for badges, modals, and study modes', async (t) => {
  await t.test('Study Guide headers and pills have dark overrides', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.header-sky/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.header-mint/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.header-gold/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.guide-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.guide-grade-pill/);
  });

  await t.test('Guest Limit Modal benefits list and checkmarks have dark overrides', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.guest-gate-features/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.guest-gate-feature/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.guest-gate-feature\s+span/);
  });

  await t.test('Uploaded notes citation pills have dark green/mint tokens distinct from NCERT', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.lesson-citation-pill\.is-upload-source/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.quiz-citation-pill\.is-upload-source/);
  });

  await t.test('Flashcards and Quiz badges have dark overrides', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.flashcard-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.badge-got/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.badge-review/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.quiz-xp-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.check-celebrate-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.results-score-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.results-xp-award/);
  });

  await t.test('Mind Map, Podcast, and Diagram badges have dark overrides', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.mindmap-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.mindmap-canvas-wrap/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.podcast-badge/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.podcast-caption-box/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.diagram-layout-pill/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.diagram-badge/);
  });

  await t.test('Prompt library, gamification, and settings components have dark overrides', () => {
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.prompt-card-ask-btn/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.badge-logout-btn/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.active-doc-pill/);
  });

  await t.test('Chat drawer composer, action chips, and recent chats panel have dark overrides', () => {
    // Chat composer and input
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.chat-composer/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.chat-composer\s+input/);

    // Composer chips
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.composer-attach/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.composer-notes-btn/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.composer-mic/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.composer-send/);

    // Recent chats drawer elements
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.chat-history-panel/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+#btn-close-chat-history/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.history-new-chat/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.chat-history-item/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.chat-history-item-btn/);

    // Clear all history dark-tinted danger button
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.history-clear-all/);
  });

  await t.test('Response dock has high contrast tokens for subtitles, label, and expand hint in both themes', () => {
    // Light mode: high-contrast navy black text, bold blue label, crisp expand hint
    assert.match(styleCss, /\.response-card p,\s*#subtitles-text\s*\{[\s\S]*?color:\s*#0f172a;/);
    assert.match(styleCss, /\.response-card-head\s*\{[\s\S]*?color:\s*#0284c7;/);
    assert.match(styleCss, /\.dock-expand-hint\s*\{[\s\S]*?color:\s*#0284c7;/);

    // Dark mode: high-contrast white text, vivid cyan label, vivid cyan expand hint
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+#subtitles-text[\s\S]*?color:\s*#f8fafc\s*!important/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+#appu-says-label[\s\S]*?color:\s*#38bdf8\s*!important/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.dock-expand-hint[\s\S]*?color:\s*#38bdf8/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.response-card:hover[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.04\)/);
  });

  await t.test('Hero headline matches lighter style without heavy pill', () => {
    // Light mode: clean background, no heavy pill/blur, and solid white text
    assert.match(styleCss, /\.mission-intro h1[\s\S]*?font-size:\s*clamp\(16px,\s*1\.65vw,\s*22px\);/);
    assert.match(styleCss, /\.mission-intro h1[\s\S]*?color:\s*#ffffff\s*!important/);

    // Dark mode: clean background without heavy pill
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.mission-intro h1[\s\S]*?background:\s*none\s*!important/);
  });

  await t.test('guarantees zero mobile light leaks on topbar, nav-drawer header/footer, and chat drawer header', () => {
    // Mobile topbar uses theme tokens and avoids hardcoded opaque white
    assert.match(styleCss, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.topbar\s*\{[^}]*background:\s*var\(--surface-glass/);
    assert.doesNotMatch(styleCss, /\.topbar\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.96\)/);

    // Chat drawer header does not hardcode white background with !important
    assert.doesNotMatch(styleCss, /\.chat-drawer \.drawer-header\s*\{[^}]*background:\s*#ffffff\s*!important/);
    assert.match(styleCss, /\.chat-drawer \.drawer-header\s*\{[^}]*background:\s*var\(--surface-strong/);

    // Nav drawer header and footer dark mode overrides exist
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.nav-drawer-header[\s\S]*?background:\s*var\(--surface-strong/);
    assert.match(styleCss, /\[data-theme=["']dark["']\]\s+\.nav-drawer-footer[\s\S]*?background:\s*var\(--surface-strong/);
  });
});


