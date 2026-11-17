(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AppuVoiceContract = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function toAudioSource(value) {
    if (typeof value !== 'string') return null;

    const audio = value.trim();
    if (!audio) return null;

    if (/^(data:audio\/|https?:\/\/|blob:)/i.test(audio)) {
      return audio;
    }

    return `data:audio/mpeg;base64,${audio}`;
  }

  function normalizeResponse(payload) {
    const value = Array.isArray(payload) ? payload[0] : payload;
    const data = value && typeof value === 'object' ? value : {};
    const rawText = data.output ?? data.text ?? data.response ?? data.message ?? '';
    const text = typeof rawText === 'string' ? rawText.replace(/\\n/g, '\n').trim() : String(rawText ?? '').trim();
    const rawAudio = data.audio_base64 ?? data.audioBase64 ?? data.audioUrl ?? data.audio_url ?? data.audio ?? data.voiceUrl;

    return {
      text,
      audioSource: toAudioSource(rawAudio)
    };
  }

  return {
    normalizeResponse,
    toAudioSource
  };
});
