import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuickReplies } from '../src/domain/conversation/quick-replies.js';

describe('extractQuickReplies', () => {
  test('returns the options and removes the tag from the text', () => {
    const r = extractQuickReplies('Which subject shall we practise?\n[[OPTIONS: Maths | Science | English]]');
    assert.equal(r.text, 'Which subject shall we practise?');
    assert.deepEqual(r.quickReplies, ['Maths', 'Science', 'English']);
  });

  test('leaves text without a tag unchanged', () => {
    const r = extractQuickReplies('Plants make food using sunlight.');
    assert.equal(r.text, 'Plants make food using sunlight.');
    assert.deepEqual(r.quickReplies, []);
  });

  test('uses the last tag, drops empty, duplicate and over-long options, keeps at most four', () => {
    const long = 'x'.repeat(61);
    const r = extractQuickReplies(`Pick one [[OPTIONS: A | B]] then\n[[options: Yes | | yes | ${long} | No | Maybe | Later | Never]]`);
    assert.equal(r.text, 'Pick one  then');
    assert.deepEqual(r.quickReplies, ['Yes', 'No', 'Maybe', 'Later']);
  });

  test('a single option is not offered as a choice', () => {
    const r = extractQuickReplies('Ready? [[OPTIONS: Yes]]');
    assert.equal(r.text, 'Ready?');
    assert.deepEqual(r.quickReplies, []);
  });
});
