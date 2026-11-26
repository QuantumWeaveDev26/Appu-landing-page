const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load, SRC_DIR } = require('./helpers/load.cjs');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []
  );
}
const sources = walk(SRC_DIR).map((f) => ({ f, s: fs.readFileSync(f, 'utf8') }));

describe('Only APPU\'s ElevenLabs voice plays', () => {
  it('no code uses the phone\'s built-in text-to-speech', () => {
    for (const { f, s } of sources) {
      assert.doesNotMatch(s, /from ['"]expo-speech['"]|Speech\.speak\(/, `device TTS in ${path.basename(f)}`);
    }
    const pkg = require('../package.json');
    assert.equal(pkg.dependencies['expo-speech'], undefined);
  });

  it('a reply without server audio stays silent (text only)', async () => {
    const players = [];
    const { voiceService } = load('lib/voiceService.ts', {
      'expo-audio': { createAudioPlayer: (src) => (players.push(src), { addListener() {}, play() {}, pause() {}, remove() {} }) },
      '../config': { config: { apiBaseUrl: 'https://api.appuai.online' } },
    });
    let finished = false;
    await voiceService.playAppuVoice({ text: 'Hello', onFinish: () => (finished = true) });
    assert.equal(players.length, 0);
    assert.equal(finished, true);
    assert.equal(voiceService.isSpeaking, false);
  });

  it('streams the ElevenLabs answer with the learner\'s sign-in and tracks speaking for barge-in', async () => {
    const players = [];
    const { voiceService } = load('lib/voiceService.ts', {
      'expo-audio': { createAudioPlayer: (src) => (players.push(src), { addListener() {}, play() {}, pause() {}, remove() {} }) },
      '../config': { config: { apiBaseUrl: 'https://api.appuai.online' } },
    });
    await voiceService.playAppuVoice({ text: 'Gravity pulls.', audioStreamUrl: '/api/appu/audio/stream/abc', accessToken: 'tok' });
    assert.equal(players[0].uri, 'https://api.appuai.online/api/appu/audio/stream/abc');
    assert.equal(players[0].headers.Authorization, 'Bearer tok');
    assert.equal(voiceService.isSpeaking, true);
    assert.equal(voiceService.speakingText, 'Gravity pulls.');
    voiceService.stopPlayback();
    assert.equal(voiceService.isSpeaking, false);
  });
});

describe('Light and dark theme', () => {
  const { theme, applyTheme, tc, toLight } = load('theme.ts');

  it('dark mode keeps every colour exactly as designed', () => {
    applyTheme('dark');
    assert.equal(tc('#0f1a2e'), '#0f1a2e');
    assert.equal(tc('#94a3b8', 't'), '#94a3b8');
    assert.equal(theme.colors.bg, '#0b1322');
  });

  it('light mode uses the website\'s light page colours', () => {
    applyTheme('light');
    assert.equal(theme.colors.bg, '#f8fafc');
    assert.equal(theme.colors.text, '#0f172a');
    applyTheme('dark');
  });

  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  it('navy surfaces turn light, light grey text turns dark and stays readable', () => {
    for (const bg of ['#0b1322', '#0f1a2e', '#12325a', '#0a1d37']) assert.ok(lum(toLight(bg, 'b')) > 0.7, `${bg} → ${toLight(bg, 'b')}`);
    for (const t of ['#cbd5e1', '#94a3b8', '#f1f5f9', '#ffffff']) {
      const out = toLight(t, 't');
      assert.ok(contrast(out, '#ffffff') >= 4.5, `${t} → ${out} contrast ${contrast(out, '#ffffff').toFixed(2)}`);
    }
  });

  it('bright accent text is darkened enough to read on white', () => {
    for (const t of ['#facc15', '#4ade80', '#fca5a5', '#38bdf8']) {
      const out = toLight(t, 't');
      assert.ok(contrast(out, '#ffffff') >= 3, `${t} → ${out}`);
    }
  });

  it('keeps dark text on bright buttons and accent tints, flips white overlays', () => {
    assert.equal(toLight('#04121f', 't'), '#04121f');
    assert.equal(toLight('rgba(14,165,233,0.15)', 'b'), 'rgba(14,165,233,0.15)');
    assert.match(toLight('rgba(255,255,255,0.04)', 'b'), /^rgba\(15, 23, 42/);
  });

  it('no screen has a colour that bypasses the theme', () => {
    for (const { f, s } of sources) {
      if (/theme\.ts$/.test(f)) continue;
      const raw = s.replace(/tc\('[^']*', '[tb]'\)/g, '').match(/['"](#[0-9a-fA-F]{3,8}|rgba?\([^)'"]*\))['"]/g);
      assert.equal(raw, null, `${path.basename(f)} has unthemed colours: ${raw}`);
    }
  });
});
