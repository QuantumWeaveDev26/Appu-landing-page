const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const cssPath = path.join(__dirname, '..', 'frontend', 'style.css');
const appJsPath = path.join(__dirname, '..', 'frontend', 'app.js');
const rendererJsPath = path.join(__dirname, '..', 'frontend', 'lesson-card-renderer.js');
const htmlPath = path.join(__dirname, '..', 'frontend', 'index.html');

const cssContent = fs.readFileSync(cssPath, 'utf8');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
const rendererJsContent = fs.readFileSync(rendererJsPath, 'utf8');
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

test.describe('Mobile UI & Sunshine & Sky Theme Polish Verification', () => {

  test.it('enforces min-height >= 44px tap targets for interactive mobile controls', () => {
    // Study toolbar buttons on mobile
    assert.match(cssContent, /\.study-tab-btn\s*\{[^}]*min-height:\s*44px/);

    // Prompt library controls
    assert.match(cssContent, /\.prompt-refresh-btn\s*\{[^}]*min-height:\s*44px/);
    assert.match(cssContent, /\.prompt-cat-tab\s*\{[^}]*min-height:\s*44px/);
    assert.match(cssContent, /\.prompt-card-ask-btn\s*\{[^}]*min-height:\s*44px/);

    // Beta banner CTA on mobile
    assert.match(cssContent, /#beta-banner-cta[\s\S]*?min-height:\s*44px/);

    // Reports modal buttons and stars
    assert.match(cssContent, /\.report-later-btn\s*\{[^}]*min-height:\s*44px/);
    assert.match(cssContent, /\.report-star\s*\{[^}]*min-height:\s*44px/);

    // Notes modal tabs
    assert.match(cssContent, /\.notes-tab\s*\{[^}]*min-height:\s*44px/);
  });

  test.it('guarantees Sunshine & Sky high-contrast palette and zero invisible white-on-white text', () => {
    // Guest gate feature text must NOT be light grey (#e2e8f0) on white
    assert.doesNotMatch(cssContent, /\.guest-gate-feature\s*\{[^}]*color:\s*#e2e8f0/);
    assert.match(cssContent, /\.guest-gate-feature\s*\{[^}]*color:\s*#0f172a/);

    // Notes dropzone title must NOT be white (#f1f5f9) on white sheet
    assert.doesNotMatch(cssContent, /\.notes-dropzone-title\s*\{[^}]*color:\s*#f1f5f9/);
    assert.match(cssContent, /\.notes-dropzone-title\s*\{[^}]*color:\s*#0f172a/);

    // Secondary modal button must NOT be globally overridden with cyan (#68f0ff)
    assert.doesNotMatch(cssContent, /#lock-btn-add-phone,\s*\.secondary-modal-btn\s*\{[^}]*color:\s*#68f0ff/);

    // Parental lock lead must have dark/slate contrast
    assert.match(cssContent, /\.parental-lock-sheet \.modal-lead\s*\{[^}]*color:\s*#64748b/);
  });

  test.it('guarantees internal vertical scroll and bounded max-height on long modals for mobile viewports', () => {
    // Guest limit modal
    assert.match(cssContent, /\.guest-limit-sheet\s*\{[^}]*max-height:\s*min\(92dvh,\s*640px\)/);
    assert.match(cssContent, /\.guest-limit-sheet\s*\{[^}]*overflow-y:\s*auto/);

    // Notes upload modal
    assert.match(cssContent, /\.notes-upload-sheet\s*\{[^}]*max-height:\s*min\(92dvh,\s*660px\)/);
    assert.match(cssContent, /\.notes-upload-sheet\s*\{[^}]*overflow-y:\s*auto/);

    // Reports sheet
    assert.match(cssContent, /\.reports-sheet\s*\{[^}]*max-height:\s*min\(92dvh,\s*680px\)/);
    assert.match(cssContent, /\.reports-sheet\s*\{[^}]*overflow-y:\s*auto/);

    // Welcome gate
    assert.match(cssContent, /\.welcome-gate\s*\{[^}]*overflow-y:\s*auto/);
  });

  test.it('enforces mobile composer flex layout to prevent 5th-button clipping', () => {
    // Composer on mobile must use flex (not a rigid 4-column grid for 5 items)
    assert.match(cssContent, /\.chat-composer\s*\{[^}]*display:\s*flex/);
  });

  test.it('enforces topbar hamburger accessibility on mobile screens', () => {
    // Topbar hamburger must be visible on mobile (@media max-width: 768px)
    assert.match(cssContent, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.topbar-hamburger\s*\{[\s\S]*?display:\s*grid/);
  });

  test.it('verifies comprehensive multilingual translations in UI_TRANSLATIONS and STUDY_TOOLBAR_LABELS', () => {
    // app.js must have guestLimit, uploadNotes, and dock translations in en, kn, and hi
    ['guestLimitTitle', 'uploadNotesBtn', 'dockExpandBtn', 'notesModalTitle', 'childProgressReport'].forEach(key => {
      assert.ok(appJsContent.includes(key), `app.js missing translation key: ${key}`);
    });

    // lesson-card-renderer.js must have STUDY_TOOLBAR_LABELS exported for en, kn, hi
    assert.ok(rendererJsContent.includes('STUDY_TOOLBAR_LABELS'));
    assert.ok(rendererJsContent.includes('ಪಾಠ')); // Kannada for Lesson
    assert.ok(rendererJsContent.includes('पाठ')); // Hindi for Lesson
  });

  test.it('verifies index.html has complete modal kickers, headings, and semantic action triggers', () => {
    assert.ok(htmlContent.includes('id="guest-limit-modal"'));
    assert.ok(htmlContent.includes('id="notes-upload-modal"'));
    assert.ok(htmlContent.includes('id="reports-modal"'));
    assert.ok(htmlContent.includes('id="parental-lock-modal"'));
    assert.ok(htmlContent.includes('id="prompt-library-panel"'));
    assert.ok(htmlContent.includes('id="btn-dock-expand"'));
    assert.ok(htmlContent.includes('id="btn-upload-notes"'));
  });

  test.it('enforces mobile single-column vertical stack with zero element collisions', () => {
    // 1) Mission deck hidden on mobile hero to prevent dock clipping
    assert.match(cssContent, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.mission-deck\s*\{[\s\S]*?display:\s*none\s*!important/);

    // 2) Hero avatar stage has bounded height on mobile
    assert.match(cssContent, /\.avatar-stage\s*\{[\s\S]*?height:\s*clamp\(200px,\s*32vh,\s*260px\)/);

    // 3) When lesson is active on mobile: mission stage is an in-flow flex column
    assert.match(cssContent, /\.mission-stage\.has-lesson-active\s*\{[\s\S]*?display:\s*flex\s*!important;\s*flex-direction:\s*column\s*!important/);

    // 4) Appu model on mobile active lesson is in-flow relative (NEVER absolute over content)
    assert.match(cssContent, /\.mission-stage\.has-lesson-active\s+\.avatar-stage\s*\{[\s\S]*?position:\s*relative\s*!important/);

    // 5) Voice reply popup on mobile active lesson is in-flow relative (NEVER absolute over content)
    assert.match(cssContent, /\.mission-stage\.has-lesson-active\s+\.voice-reply-popup\s*\{[\s\S]*?position:\s*relative\s*!important/);

    // 6) Concept tree branches on mobile stack in a single full-width column
    assert.match(cssContent, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.concept-tree-branches-grid[\s\S]*?grid-template-columns:\s*1fr\s*!important/);
  });

  test.it('verifies nav drawer houses learning missions cleanly for mobile access', () => {
    // Nav drawer must have missions section with 4 mission action buttons
    assert.ok(htmlContent.includes('class="nav-drawer-missions"'));
    assert.ok(htmlContent.includes('id="drawer-chip-explain"'));
    assert.ok(htmlContent.includes('id="drawer-chip-quiz"'));
    assert.ok(htmlContent.includes('id="drawer-chip-homework"'));
    assert.ok(htmlContent.includes('id="drawer-chip-exam"'));

    // Drawer mission buttons must have tap targets >= 48px
    assert.match(cssContent, /\.nav-drawer-mission-btn\s*\{[^}]*min-height:\s*48px/);

    // Drawer missions title translated in en, kn, and hi
    assert.ok(appJsContent.includes('drawerMissionsTitle'));
    assert.ok(appJsContent.includes("'Learning Missions'"));
    assert.ok(appJsContent.includes("'ಕಲಿಕಾ ಕಾರ್ಯಗಳು'"));
    assert.ok(appJsContent.includes("'सीखने के मिशन'"));
  });

  test.it('enforces desktop layout separation so Appu never collides with study content', () => {
    // 1) Default mind map in lesson view stays in diagram column (flanking Appu)
    assert.match(cssContent, /\.lesson-block-mindmap-default[\s\S]*?grid-area:\s*diagram/);

    // 2) In dedicated study mode (mindmap, quiz, etc.), Appu moves to upper-right corner
    assert.match(cssContent, /\.mission-stage\.has-lesson-active\.mode-is-study-card\s+\.avatar-stage\s*\{[\s\S]*?right:\s*24px\s*!important/);
  });
});
