/**
 * Whole-app checks that every button does something, every menu item is wired, every screen
 * is registered, and the website features are present.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SRC_DIR } = require('./helpers/load.cjs');

const read = (rel) => fs.readFileSync(path.join(SRC_DIR, rel), 'utf8');
const tsxFiles = ['screens', 'components', 'lessons'].flatMap((d) =>
  fs.readdirSync(path.join(SRC_DIR, d)).filter((f) => f.endsWith('.tsx')).map((f) => `${d}/${f}`)
);

/** Returns the opening tag text of each <Tag ...> (handles nested braces and arrows). */
function openingTags(src, tag) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf(`<${tag}`, i)) !== -1) {
    const next = src[i + tag.length + 1];
    if (/[A-Za-z]/.test(next)) {
      i += 1;
      continue;
    }
    let depth = 0;
    let j = i;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0 && src[j - 1] !== '=') break;
    }
    out.push(src.slice(i, j + 1));
    i = j;
  }
  return out;
}

describe('Every button works', () => {
  for (const file of tsxFiles) {
    it(`${file}: every touchable has an action`, () => {
      const src = read(file);
      for (const tag of ['TouchableOpacity', 'Pressable', 'TouchableHighlight']) {
        for (const t of openingTags(src, tag)) {
          assert.match(t, /\bonPress=/, `${file}: ${tag} without onPress → ${t.slice(0, 120)}`);
        }
      }
    });
  }
});

describe('Menu and navigation', () => {
  const drawer = read('components/SideDrawer.tsx');
  const chat = read('screens/ChatScreen.tsx');
  const types = read('navigation/types.ts');
  const nav = read('navigation/RootNavigator.tsx');

  it('every sidebar action is handled by the chat screen', () => {
    const union = drawer.match(/export type DrawerAction =([\s\S]*?);/)[1];
    const actions = [...union.matchAll(/'(\w+)'/g)].map((m) => m[1]);
    assert.ok(actions.length >= 12);
    for (const a of actions) {
      assert.match(chat, new RegExp(`case '${a}':`), `DrawerAction '${a}' is not handled`);
      assert.match(drawer, new RegExp(`act\\('${a}'\\)`), `DrawerAction '${a}' has no button`);
    }
  });

  it('the sidebar follows the website order', () => {
    const order = ['New chat', 'Recent chats', 'My Learning', 'My Progress', 'Learning missions', 'Parent Zone', 'Child Progress Report', 'Settings'];
    const idx = order.map((label) => drawer.indexOf(label));
    idx.forEach((v, k) => assert.ok(v > 0, `missing "${order[k]}"`));
    assert.deepEqual([...idx].sort((a, b) => a - b), idx);
  });

  it('every screen in the route list is registered, and the chat is the home screen', () => {
    const routes = [...types.match(/RootStackParamList = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]);
    for (const r of routes) assert.match(nav, new RegExp(`name="${r}"`), `route ${r} not registered`);
    assert.match(nav, /name="Home" component=\{ChatScreen\}/);
  });

  it('every navigate() target exists', () => {
    const routes = new Set([...types.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
    for (const file of tsxFiles) {
      for (const m of read(file).matchAll(/navigat(?:e|ion\.navigate|ion\.replace)\('(\w+)'/g)) {
        assert.ok(routes.has(m[1]), `${file} navigates to unknown route ${m[1]}`);
      }
    }
  });
});

describe('Website features are present', () => {
  const chat = read('screens/ChatScreen.tsx');
  it('chat-first home: greeting, 4 missions, Free Beta, composer with +, mic, call, send', () => {
    assert.match(chat, /What shall we learn today\?/);
    assert.match(chat, /Free Beta/);
    assert.match(read('components/SideDrawer.tsx'), /Explain My Topic[\s\S]*Play a Quick Quiz[\s\S]*Homework Helper[\s\S]*Exam Practice/);
    for (const label of ['Add a photo or notes', 'Start a voice call with Appu', 'Send']) assert.match(chat, new RegExp(label));
    assert.match(chat, /onPress=\{toggleMic\}/);
    assert.match(chat, /onPress=\{startCall\}/);
  });

  it('answers carry Listen, Share, WhatsApp, Save lesson and the inline study tabs', () => {
    for (const label of ['🔊 Listen', '↗ Share', '💬 WhatsApp', '☆ Save lesson']) assert.ok(chat.includes(label), label);
    assert.match(chat, /<StudyModes lesson=\{lesson\} \/>/);
    const views = read('lessons/LessonViews.tsx');
    for (const tab of ['👀 See it', '⚡ Quiz', '🗂️ Flashcards', '🔍 Diagram', '📝 Notes', '🎧 Audio story']) assert.ok(views.includes(tab), tab);
  });

  it('answers show picture visuals: comic-strip steps and a drawn mind map', () => {
    const views = read('lessons/LessonViews.tsx');
    assert.match(views, /<DoodleStory lesson=\{lesson\} \/>/);
    assert.match(views, /<DoodleMindMap lesson=\{lesson\} \/>/);
    const doodle = read('lessons/DoodleVisual.tsx');
    assert.match(doodle, /See it in steps/);
    assert.match(doodle, /Mind map/);
  });

  it('the message bar rises above the phone keyboard', () => {
    assert.match(chat, /import \{ KeyboardAvoidingView \} from 'react-native-keyboard-controller'/);
    assert.match(chat, /<KeyboardAvoidingView\s+behavior="padding"/);
    assert.match(fs.readFileSync(path.join(SRC_DIR, '..', 'App.tsx'), 'utf8'), /<KeyboardProvider>/);
  });

  it('tapping the call orb interrupts Appu and listens again', () => {
    assert.match(chat, /voiceService\.stopPlayback\(\);\s+setPlayingMessageId\(null\);\s+liveVoice\.resume\(\);/);
  });

  it('call start and end are noted in the chat', () => {
    assert.match(chat, /📞 Voice call started/);
    assert.match(chat, /📞 Voice call ended/);
  });

  it('parental lock never shows unless the server turns it on', () => {
    assert.match(read('components/ParentalLock.tsx'), /res\.enabled !== true\) return/);
  });

  it('brain break is only for Class 5–8', () => {
    assert.match(read('components/BrainBreak.tsx'), /grade >= 5 && grade <= 8/);
  });

  it('chat messages are never machine-translated', () => {
    assert.match(chat, /<Text noTranslate style=\{styles\.n_userText\}>/);
    assert.match(chat, /<Text noTranslate style=\{styles\.n_appuText\}>/);
  });
});

describe('Reopened chats', () => {
  const chat = read('screens/ChatScreen.tsx');
  it('new pictures are kept on the phone and brought back when history is opened', () => {
    assert.match(chat, /if \(lesson\) void rememberLesson\(replyText, lesson\)/);
    assert.match(chat, /await restoreLessons\(/);
  });
  it('the latest chat opens again when the app starts, as on the website', () => {
    assert.match(chat, /fetchConversations\(token, childId\)[\s\S]{0,120}untouchedRef\.current\) void handleSelectConversation\(list\[0\]\.id\)/);
  });
  it('older answers get a button that draws their pictures', () => {
    assert.match(chat, /lessonState === 'missing'[\s\S]{0,200}drawPictures\(item\)/);
  });
});

describe('Guided tour', () => {
  const chat = read('screens/ChatScreen.tsx');
  const tour = read('components/SpotlightTour.tsx');

  it('every tour step points at a real button on the home screen', () => {
    const targets = [...tour.matchAll(/target: '(\w+)'/g)].map((m) => m[1]);
    assert.ok(targets.length >= 8);
    for (const t of new Set(targets)) {
      assert.match(chat, new RegExp(`ref=\\{tourTargets\\.${t}\\}`), `no button marked for tour step "${t}"`);
    }
  });

  it('opens after the menu has closed (two pop-ups at once do not show on Android)', () => {
    assert.match(chat, /case 'tour':\s+return openTour\(\);/);
    assert.match(chat, /const openTour = \(\) => setTimeout\(\(\) => setIsTourOpen\(true\), \d{3}\)/);
  });

  it('starts from Settings on the home screen, and once for new learners', () => {
    assert.match(read('screens/SettingsScreen.tsx'), /navigate\('Home', \{ startTour: true \}\)/);
    assert.match(chat, /!tourDone && !isAuthRequired/);
    assert.match(chat, /setOnboardingCompleted\(true\)/);
  });

  it('the old mascot picture is gone from the chat', () => {
    assert.doesNotMatch(chat, /appu_cutout|APPU_FACE/);
  });
});

describe('Release setup', () => {
  it('store builds use the real app id; test builds keep the dev id', () => {
    const cfg = require('../app.config.js');
    const base = { android: { package: 'online.appuai.appudev' }, ios: {} };
    const prev = process.env.APP_VARIANT;
    process.env.APP_VARIANT = 'production';
    assert.equal(cfg({ config: base }).android.package, 'online.appuai.appu');
    delete process.env.APP_VARIANT;
    assert.equal(cfg({ config: base }).android.package, 'online.appuai.appudev');
    if (prev !== undefined) process.env.APP_VARIANT = prev;
    assert.equal(require('../eas.json').build.production.env.APP_VARIANT, 'production');
  });

  it('asks for the microphone and camera with clear reasons', () => {
    const app = require('../app.json').expo;
    assert.ok(app.android.permissions.includes('android.permission.RECORD_AUDIO'));
    assert.ok(app.android.permissions.includes('android.permission.CAMERA'));
    const picker = app.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker');
    assert.match(picker[1].cameraPermission, /homework/);
  });
});
