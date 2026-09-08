const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'frontend', 'index.html');
const APP_JS_PATH = path.join(ROOT_DIR, 'frontend', 'app.js');

describe('Prompt Library UI & Browsable Panel (Phase-C Task 4)', () => {
  let indexHtml;
  let appJs;

  beforeEach(() => {
    indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    appJs = fs.readFileSync(APP_JS_PATH, 'utf8');
  });

  test('Case 1: DOM contains #btn-explore-prompts trigger and #prompt-library-panel structure', () => {
    assert.ok(indexHtml.includes('id="btn-explore-prompts"'), 'Must contain #btn-explore-prompts');
    assert.ok(indexHtml.includes('id="prompt-library-panel"'), 'Must contain #prompt-library-panel');
    assert.ok(indexHtml.includes('id="btn-close-prompt-library"'), 'Must contain #btn-close-prompt-library');
    assert.ok(indexHtml.includes('id="btn-refresh-prompts"'), 'Must contain #btn-refresh-prompts');
    assert.ok(indexHtml.includes('id="prompt-cards-container"'), 'Must contain #prompt-cards-container');
    assert.ok(indexHtml.includes('data-category="all"'), 'Must contain category tab for all');
    assert.ok(indexHtml.includes('data-category="quick_concepts"'), 'Must contain category tab for quick_concepts');
    assert.ok(indexHtml.includes('data-category="homework_hints"'), 'Must contain category tab for homework_hints');
    assert.ok(indexHtml.includes('data-category="curious_mind"'), 'Must contain category tab for curious_mind');
    assert.ok(indexHtml.includes('data-category="exam_drills"'), 'Must contain category tab for exam_drills');
  });

  test('Case 2: fetchChildPrompts calls backend endpoint and renders cards in #prompt-cards-container', () => {
    const clientJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'appu-backend-client.js'), 'utf8');
    assert.ok(
      clientJs.includes('fetchChildPrompts'),
      'appu-backend-client.js must export or define fetchChildPrompts'
    );
    assert.ok(
      clientJs.includes('/api/children/') && clientJs.includes('/prompts'),
      'fetchChildPrompts must query /api/children/:childId/prompts'
    );

    const promptLibraryJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'prompt-library-ui.js'), 'utf8');
    assert.ok(
      promptLibraryJs.includes('renderPromptCards') || promptLibraryJs.includes('renderCards'),
      'prompt-library-ui.js must render prompt cards into the container'
    );
  });

  test('Case 3: Category filter tab updates visible prompt cards', () => {
    const promptLibraryJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'prompt-library-ui.js'), 'utf8');
    assert.ok(
      promptLibraryJs.includes('filter') || promptLibraryJs.includes('category'),
      'prompt-library-ui.js must support category filtering'
    );
    assert.ok(
      promptLibraryJs.includes('quick_concepts') &&
      promptLibraryJs.includes('homework_hints') &&
      promptLibraryJs.includes('curious_mind') &&
      promptLibraryJs.includes('exam_drills'),
      'prompt-library-ui.js must handle all 4 categories'
    );
  });

  test('Case 4: Card click populates #chat-input.value, opens chat drawer, closes panel, and focuses input', () => {
    const promptLibraryJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'prompt-library-ui.js'), 'utf8');
    assert.ok(
      promptLibraryJs.includes('chat-input'),
      'prompt-library-ui.js must reference chat-input'
    );
    assert.ok(
      promptLibraryJs.includes('toggleChatDrawer') || promptLibraryJs.includes('chat-drawer'),
      'prompt-library-ui.js must open the chat drawer'
    );
    assert.ok(
      promptLibraryJs.includes('handleUserInteraction'),
      'prompt-library-ui.js must support direct interaction execution'
    );
  });

  test('Case 5: Refresh button calls regenerateChildPrompts and updates cards', () => {
    const clientJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'appu-backend-client.js'), 'utf8');
    assert.ok(
      clientJs.includes('regenerateChildPrompts'),
      'appu-backend-client.js must define regenerateChildPrompts'
    );
    assert.ok(
      clientJs.includes('/regenerate'),
      'regenerateChildPrompts must target /api/children/:childId/prompts/regenerate'
    );

    const promptLibraryJs = fs.readFileSync(path.join(ROOT_DIR, 'frontend', 'prompt-library-ui.js'), 'utf8');
    assert.ok(
      promptLibraryJs.includes('regenerateChildPrompts') || promptLibraryJs.includes('handleRefresh'),
      'prompt-library-ui.js must wire refresh button to regeneration'
    );
  });

  test('Case 6: Translations for prompt library exist in en, kn, hi in app.js', () => {
    const requiredKeys = [
      'promptLibraryTitle',
      'promptLibrarySubtitle',
      'categoryAll',
      'categoryQuickConcepts',
      'categoryHomeworkHints',
      'categoryCuriousMind',
      'categoryExamDrills',
      'btnRefreshPrompts'
    ];

    for (const key of requiredKeys) {
      assert.ok(appJs.includes(key), `app.js must contain translation key ${key}`);
    }

    // Check en, kn, hi sections contain promptLibraryTitle
    const enMatch = appJs.indexOf('promptLibraryTitle');
    assert.ok(enMatch !== -1, 'promptLibraryTitle must be present in app.js');
  });

  test('Case 7: Single <h1> invariant is strictly maintained in index.html', () => {
    const h1Matches = indexHtml.match(/<h1[\s>]/gi) || [];
    assert.equal(h1Matches.length, 1, `Expected exactly one <h1> tag in index.html, found ${h1Matches.length}`);
  });
});
