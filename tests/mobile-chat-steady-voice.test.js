const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styleCss = fs.readFileSync(path.resolve(__dirname, '../frontend/style.css'), 'utf8');
const voiceEngineJs = fs.readFileSync(path.resolve(__dirname, '../frontend/voice-engine.js'), 'utf8');

describe('Mobile Chat Drawer UI Layout', () => {
  test('style.css defines full-width, edge-to-edge chat drawer under @media (max-width: 768px)', () => {
    // Assert 100% width and pinned edges
    assert.match(styleCss, /\.chat-drawer[\s\S]*?width:\s*100%\s*!important/);
    assert.match(styleCss, /\.chat-drawer[\s\S]*?left:\s*0\s*!important/);
    assert.match(styleCss, /\.chat-drawer[\s\S]*?right:\s*0\s*!important/);
    assert.match(styleCss, /\.chat-drawer[\s\S]*?max-width:\s*100vw\s*!important/);
  });

  test('style.css ensures mobile chat drawer has zero negative offsets and transforms cleanly', () => {
    assert.match(styleCss, /\.chat-drawer[\s\S]*?transform:\s*translateX\(100%\)\s*!important/);
    assert.match(styleCss, /\.chat-drawer\.is-open[\s\S]*?transform:\s*(?:translateX\(0\)|none)\s*!important/);
    assert.match(styleCss, /\.chat-drawer[\s\S]*?box-sizing:\s*border-box\s*!important/);
  });

  test('style.css enforces flex column layout so message list fills vertical space without dead white void', () => {
    assert.match(styleCss, /\.chat-drawer[\s\S]*?display:\s*flex\s*!important/);
    assert.match(styleCss, /\.chat-drawer[\s\S]*?flex-direction:\s*column\s*!important/);
    assert.match(styleCss, /\.chat-drawer\s+\.chat-messages[\s\S]*?flex:\s*1\s+1\s+auto\s*!important/);
    assert.match(styleCss, /\.chat-drawer\s+\.chat-messages[\s\S]*?overflow-y:\s*auto\s*!important/);
    assert.match(styleCss, /\.chat-drawer\s+\.chat-composer[\s\S]*?flex-shrink:\s*0\s*!important/);
  });

  test('style.css handles safe-area insets cleanly on header and composer', () => {
    assert.match(styleCss, /\.chat-drawer\s+\.drawer-header[\s\S]*?env\(safe-area-inset-top/);
    assert.match(styleCss, /\.chat-drawer\s+\.chat-composer[\s\S]*?env\(safe-area-inset-bottom/);
  });
});

describe('VoiceEngine: Steady Listening & 60s Silence Auto-Stop', () => {
  test('SpeechRecognition continuous is set to true and interimResults is true', () => {
    assert.match(voiceEngineJs, /this\.recognition\.continuous\s*=\s*true/);
    assert.match(voiceEngineJs, /this\.recognition\.interimResults\s*=\s*true/);
  });

  test('VoiceEngine initializes silenceTimeoutMs to 60000ms', () => {
    assert.match(voiceEngineJs, /this\.silenceTimeoutMs\s*=\s*60000/);
    assert.match(voiceEngineJs, /this\.silenceTimer\s*=\s*null/);
  });

  test('VoiceEngine defines startSilenceTimer, resetSilenceTimer, clearSilenceTimer, and handleSilenceTimeout', () => {
    assert.match(voiceEngineJs, /startSilenceTimer\(\)\s*\{/);
    assert.match(voiceEngineJs, /resetSilenceTimer\(\)\s*\{/);
    assert.match(voiceEngineJs, /clearSilenceTimer\(\)\s*\{/);
    assert.match(voiceEngineJs, /handleSilenceTimeout\(\)\s*\{/);
  });

  test('VoiceEngine resets silence timer on speech activity and interim/final transcripts', () => {
    // In onresult
    assert.match(voiceEngineJs, /onresult\s*=\s*event\s*=>[\s\S]*?this\.resetSilenceTimer\(\)/);
    // On final transcript, clears silence timer before calling onTranscript
    assert.match(voiceEngineJs, /this\.clearSilenceTimer\(\);[\s\S]*?this\.awaitingResponse\s*=\s*true;[\s\S]*?this\.recognition\.abort\(\);[\s\S]*?this\.onTranscript\(/);
  });

  test('VoiceEngine ignores no-speech in onerror without flickering UI or killing session early', () => {
    assert.match(voiceEngineJs, /if\s*\(\s*event\.error\s*===\s*['"]no-speech['"]\s*\)\s*\{\s*return;\s*\}/);
  });

  test('VoiceEngine seamlessly restarts on unexpected onend without flickering UI or chiming', () => {
    assert.match(voiceEngineJs, /this\._isReconnecting\s*=\s*true;/);
    assert.match(voiceEngineJs, /if\s*\(!this\._isReconnecting\)\s*\{[\s\S]*?this\.playListenStart\(\);/);
  });

  test('stopLiveSession and stopListening clear silence timer', () => {
    assert.match(voiceEngineJs, /stopLiveSession\(\)\s*\{[\s\S]*?this\.clearSilenceTimer\(\);/);
    assert.match(voiceEngineJs, /stopListening\(\)\s*\{[\s\S]*?this\.clearSilenceTimer\(\);/);
  });

  test('VoiceEngine preserves secure-origin gating (getUserMedia + SpeechRecognition)', () => {
    assert.match(voiceEngineJs, /navigator\.mediaDevices\.getUserMedia/);
    assert.match(voiceEngineJs, /static\s+isVoiceSupported\(\)\s*\{/);
  });
});
