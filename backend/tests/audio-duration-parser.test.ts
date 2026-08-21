import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAudioDuration,
  parseMp3DurationMs,
  parseWavDurationMs,
  extractAudioBuffer
} from '../src/domain/gateway/audio-duration-parser.js';

describe('Server-Side Audio Duration Parser', () => {
  it('accepts valid explicit positive duration metadata from upstream provider', () => {
    const duration = parseAudioDuration('data:audio/mpeg;base64,AAAA', 4500);
    assert.equal(duration, 4500);
  });

  it('rejects invalid or non-numeric explicit duration metadata and falls back to audio bytes', () => {
    assert.equal(parseAudioDuration(null, -500), null);
    assert.equal(parseAudioDuration(null, NaN), null);
    assert.equal(parseAudioDuration(null, '5000'), null);
  });

  it('returns null for missing, empty, or unparseable audio', () => {
    assert.equal(parseAudioDuration(null), null);
    assert.equal(parseAudioDuration(''), null);
    assert.equal(parseAudioDuration('   '), null);
    assert.equal(parseAudioDuration('not-base64!@#$'), null);
  });

  it('parses valid WAV audio buffer correctly', () => {
    // Construct a minimal 44-byte WAV header for 1 second of 44.1kHz 16-bit mono audio (88,200 bytes/sec)
    const sampleRate = 44100;
    const channels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * channels * (bitsPerSample / 8); // 88200
    const dataSize = 88200; // 1 second of audio
    const totalSize = 36 + dataSize;

    const wavBuf = Buffer.alloc(44 + dataSize);
    wavBuf.write('RIFF', 0);
    wavBuf.writeUInt32LE(totalSize, 4);
    wavBuf.write('WAVE', 8);
    wavBuf.write('fmt ', 12);
    wavBuf.writeUInt32LE(16, 16); // subchunk size
    wavBuf.writeUInt16LE(1, 20);  // audio format (PCM)
    wavBuf.writeUInt16LE(channels, 22);
    wavBuf.writeUInt32LE(sampleRate, 24);
    wavBuf.writeUInt32LE(byteRate, 28);
    wavBuf.writeUInt16LE(channels * (bitsPerSample / 8), 32);
    wavBuf.writeUInt16LE(bitsPerSample, 34);
    wavBuf.write('data', 36);
    wavBuf.writeUInt32LE(dataSize, 40);

    const measuredMs = parseWavDurationMs(wavBuf);
    assert.equal(measuredMs, 1000);

    const measuredFromDataUri = parseAudioDuration(
      `data:audio/wav;base64,${wavBuf.toString('base64')}`
    );
    assert.equal(measuredFromDataUri, 1000);
  });

  it('parses MPEG-1 Layer 3 MP3 audio stream correctly', () => {
    // Construct valid MPEG-1 Layer 3 frame: 128kbps, 44100Hz, 1152 samples per frame (417 bytes frame len)
    // Frame header: 0xFF, 0xFB, 0x90, 0x64
    const frameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    const frameLen = 417; // Math.floor(144 * 128000 / 44100) = 417
    const singleFrame = Buffer.alloc(frameLen);
    frameHeader.copy(singleFrame, 0);

    // Concatenate 10 frames = 10 * 1152 samples = 11520 samples / 44100 = ~261.22 ms
    const mp3Buf = Buffer.concat(Array(10).fill(singleFrame));
    const durationMs = parseMp3DurationMs(mp3Buf);

    assert.equal(durationMs, 261);
  });

  it('parses ElevenLabs / Lavf ID3v2-tagged MP3 stream correctly', () => {
    // Construct ID3v2 header (10 bytes) + 20 MP3 frames
    // ID3v2 header: 'ID3', ver=4.0, flags=0, syncsafe size = 128 bytes
    const id3Header = Buffer.alloc(10);
    id3Header.write('ID3', 0, 'ascii');
    id3Header[3] = 4; // v2.4
    id3Header[4] = 0;
    id3Header[5] = 0;
    id3Header[6] = 0;
    id3Header[7] = 0;
    id3Header[8] = 1;
    id3Header[9] = 0; // size = 128 bytes

    const id3Padding = Buffer.alloc(128);
    const frameHeader = Buffer.from([0xff, 0xfb, 0x90, 0x64]);
    const frameLen = 417;
    const singleFrame = Buffer.alloc(frameLen);
    frameHeader.copy(singleFrame, 0);

    // 20 frames = 20 * 1152 = 23,040 samples / 44100 = 522.44 ms -> 522 ms
    const mp3WithId3 = Buffer.concat([id3Header, id3Padding, ...Array(20).fill(singleFrame)]);

    const measuredMs = parseMp3DurationMs(mp3WithId3);
    assert.equal(measuredMs, 522);
  });

  it('fails closed (returns null) for malformed, corrupted, or truncated audio bitstreams', () => {
    // Malformed MP3 sync word with corrupted payload
    const corruptMp3 = Buffer.from([0xff, 0xfb, 0x00, 0x00, 0x12, 0x34, 0x56]);
    assert.equal(parseMp3DurationMs(corruptMp3), null);

    // Truncated WAV header
    const corruptWav = Buffer.from('RIFF1234WAVEfmt ');
    assert.equal(parseWavDurationMs(corruptWav), null);

    // Random non-audio binary data
    const randomBinary = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a]);
    assert.equal(parseAudioDuration(randomBinary), null);

    // Unsupported format (e.g. OGG/FLAC without explicit duration)
    const oggHeader = Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00');
    assert.equal(parseAudioDuration(oggHeader), null);
  });
});

