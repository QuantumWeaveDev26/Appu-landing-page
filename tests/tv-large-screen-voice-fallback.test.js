import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '../frontend');

test('TV & Large Screen Responsive Stylesheet Invariants', () => {
  const css = fs.readFileSync(path.join(frontendDir, 'style.css'), 'utf8');

  // 1. Check media query breakpoints
  assert.ok(css.includes('@media (min-width: 1800px)'), 'style.css must contain 1800px breakpoint for 1080p Smart TVs');
  assert.ok(css.includes('@media (min-width: 2400px)'), 'style.css must contain 2400px breakpoint for 2K/1440p displays');
  assert.ok(css.includes('@media (min-width: 3600px)'), 'style.css must contain 3600px breakpoint for 4K UHD Smart TVs');

  // 2. Check shell centering and max-width capping (preventing edge-to-edge stretching)
  assert.match(css, /\.app-shell\s*\{[^}]*max-width:\s*1680px/s, '1080p tier must cap app-shell at 1680px');
  assert.match(css, /\.app-shell\s*\{[^}]*max-width:\s*2000px/s, '2K/1440p tier must cap app-shell at 2000px');
  assert.match(css, /\.app-shell\s*\{[^}]*max-width:\s*2500px/s, '4K UHD tier must cap app-shell at 2500px');
  assert.match(css, /\.app-shell\s*\{[^}]*margin:\s*0 auto/s, 'Large screens must center app-shell with margin: 0 auto');

  // 3. Check TV overscan safe padding margins
  assert.ok(css.includes('max(40px, env(safe-area-inset-right))'), '1080p tier must provide at least 40px overscan safe padding');
  assert.ok(css.includes('max(60px, env(safe-area-inset-right))'), '2K tier must provide at least 60px overscan safe padding');
  assert.ok(css.includes('max(80px, env(safe-area-inset-right))'), '4K tier must provide at least 80px overscan safe padding');

  // 4. Check TV voice unsupported / fallback styling
  assert.ok(css.includes('.control-dock.voice-unsupported'), 'Must style control-dock when voice is unsupported');
  assert.ok(css.includes('.composer-mic.voice-unavailable'), 'Must style composer-mic when voice is unavailable');
  assert.ok(css.includes('.pulse-highlight'), 'Must include pulse-highlight for promoting chat trigger');
});

test('VoiceEngine TV/Browser Capability Detection and Fallbacks', () => {
  const code = fs.readFileSync(path.join(frontendDir, 'voice-engine.js'), 'utf8');

  // Test execution within mock environment
  function createMockEnv(hasSpeechRec, hasGetUserMedia) {
    const windowMock = {
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout: () => 1,
      clearTimeout: () => {},
      matchMedia: () => ({ matches: false })
    };
    if (hasSpeechRec) {
      windowMock.SpeechRecognition = function() {
        this.start = () => {};
        this.stop = () => {};
      };
    }
    const navigatorMock = {
      mediaDevices: hasGetUserMedia ? { getUserMedia: () => Promise.resolve({}) } : undefined
    };

    const elements = {};
    const getEl = (id) => {
      if (!elements[id]) {
        elements[id] = {
          id,
          classList: {
            classes: new Set(),
            add(cls) { this.classes.add(cls); },
            remove(cls) { this.classes.delete(cls); },
            contains(cls) { return this.classes.has(cls); }
          },
          setAttribute: () => {},
          style: {},
          dataset: {}
        };
      }
      return elements[id];
    };

    const documentMock = {
      body: { appendChild: () => {} },
      getElementById: (id) => getEl(id),
      querySelector: (sel) => getEl(sel),
      querySelectorAll: () => []
    };

    const context = {
      window: windowMock,
      navigator: navigatorMock,
      document: documentMock,
      AudioContext: function() {
        this.createAnalyser = () => ({ fftSize: 256, frequencyBinCount: 128, getByteFrequencyData: () => {} });
        this.createMediaStreamSource = () => ({ connect: () => {} });
        this.state = 'running';
        this.resume = () => Promise.resolve();
      },
      Audio: function() {
        this.play = () => Promise.resolve();
        this.pause = () => {};
        this.addEventListener = () => {};
        this.removeEventListener = () => {};
      },
      console
    };
    vm.createContext(context);
    return { context, elements };
  }

  // Case 1: Both speech recognition and getUserMedia exist -> voice is supported
  {
    const { context } = createMockEnv(true, true);
    vm.runInContext(`${code}; globalThis.VoiceEngine = VoiceEngine;`, context);
    const VE = context.VoiceEngine;
    assert.equal(VE.isVoiceSupported(), true, 'isVoiceSupported must return true when both APIs exist');
  }

  // Case 2: Smart TV browser where getUserMedia is missing -> voice unsupported
  {
    const { context } = createMockEnv(true, false);
    vm.runInContext(`${code}; globalThis.VoiceEngine = VoiceEngine;`, context);
    const VE = context.VoiceEngine;
    assert.equal(VE.isVoiceSupported(), false, 'isVoiceSupported must return false when getUserMedia is missing');
  }

  // Case 3: TV browser where SpeechRecognition is missing -> voice unsupported
  {
    const { context } = createMockEnv(false, true);
    vm.runInContext(`${code}; globalThis.VoiceEngine = VoiceEngine;`, context);
    const VE = context.VoiceEngine;
    assert.equal(VE.isVoiceSupported(), false, 'isVoiceSupported must return false when SpeechRecognition is missing');
  }

  // Case 4: Neither exists -> voice unsupported
  {
    const { context } = createMockEnv(false, false);
    vm.runInContext(`${code}; globalThis.VoiceEngine = VoiceEngine;`, context);
    const VE = context.VoiceEngine;
    assert.equal(VE.isVoiceSupported(), false, 'isVoiceSupported must return false when neither API exists');
  }

  // Case 5: Localized messages exist in en, kn, hi
  {
    const { context } = createMockEnv(false, false);
    vm.runInContext(`${code}; globalThis.VoiceEngine = VoiceEngine;`, context);
    const VE = context.VoiceEngine;
    const msgs = VE.VOICE_MESSAGES;
    assert.ok(msgs.en && msgs.kn && msgs.hi, 'VOICE_MESSAGES must contain en, kn, hi');
    assert.ok(msgs.en.unsupported.includes("Voice isn't available on this screen"), 'en unsupported copy must match spec');
    assert.ok(msgs.kn.unsupported.includes("ಈ ಪರದೆಯಲ್ಲಿ ಧ್ವನಿ ಲಭ್ಯವಿಲ್ಲ"), 'kn unsupported copy must match spec');
    assert.ok(msgs.hi.unsupported.includes("इस स्क्रीन पर वॉइस उपलब्ध नहीं है"), 'hi unsupported copy must match spec');
  }

  // Case 6: Fallback callbacks and notices when starting live session on unsupported device
  {
    const { context } = createMockEnv(false, false);
    vm.runInContext(`${code}; globalThis.VoiceEngine = VoiceEngine;`, context);
    const VE = context.VoiceEngine;

    let unavailableNoticeCalled = null;
    const engine = new VE({
      onVoiceUnavailable: (notice) => { unavailableNoticeCalled = notice; }
    });

    assert.equal(engine.isVoiceSupported, false);
    engine.toggleLiveSession();
    assert.ok(unavailableNoticeCalled, 'Calling toggleLiveSession on unsupported device must fire onVoiceUnavailable');
    assert.equal(engine.liveSessionActive, false, 'liveSessionActive must remain false');
  }
});
