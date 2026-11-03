import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuickReplies, ensureTurnQuickReplies } from '../src/domain/conversation/quick-replies.js';

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

  test('extracts ["Math", "Science", "Something else"] from n8n run 49841 when last "?" sentence is rhetorical', () => {
    const input =
      "Hey! Let's kick off your exam prep with the subject you feel needs the most power-up right now. " +
      'Is it Math, Science, or maybe something else? ' +
      "Which one gets your adrenaline going—or the one that's making you blink twice?";
    const r = extractQuickReplies(input);
    assert.equal(r.text, input);
    assert.deepEqual(r.quickReplies, ['Math', 'Science', 'Something else']);
  });

  test('extracts two-clause action options from "X, or Y?" and "X — or Y?" style questions', () => {
    const input = 'Want to try an example together, or should I show you the secret trick for this?';
    assert.deepEqual(extractQuickReplies(input).quickReplies, ['Try an example together', 'Show me the secret trick']);

    const emDashTwoClause = 'Want to try an example together — or should I show you the secret trick for this?';
    assert.deepEqual(extractQuickReplies(emDashTwoClause).quickReplies, ['Try an example together', 'Show me the secret trick']);
  });

  test('extracts full choice list after em dash, en dash, and spaced hyphen before the list', () => {
    assert.deepEqual(
      extractQuickReplies(
        'Hey! Ready for a quick brain workout? Which subject should we tackle today—Math, Science, or something else?'
      ).quickReplies,
      ['Math', 'Science', 'Something else']
    );
    assert.deepEqual(
      extractQuickReplies(
        'Hey! Ready for a quick brain workout? Which subject should we tackle today – Math, Science, or something else?'
      ).quickReplies,
      ['Math', 'Science', 'Something else']
    );
    assert.deepEqual(
      extractQuickReplies(
        'Hey! Ready for a quick brain workout? Which subject should we tackle today - Math, Science, or something else?'
      ).quickReplies,
      ['Math', 'Science', 'Something else']
    );
  });

  test('extracts options from colon-separated and non-Oxford-comma choice questions', () => {
    assert.deepEqual(
      extractQuickReplies('Which one: Maths or English?').quickReplies,
      ['Maths', 'English']
    );
    assert.deepEqual(
      extractQuickReplies('Should we start with Physics, Chemistry or Biology?').quickReplies,
      ['Physics', 'Chemistry', 'Biology']
    );
  });

  test('does not trigger on open or rhetorical questions', () => {
    assert.deepEqual(extractQuickReplies('Can you guess what gas plants release?').quickReplies, []);
    assert.deepEqual(extractQuickReplies('What do you think happens next?').quickReplies, []);
    assert.deepEqual(extractQuickReplies('Why do objects float or sink in water?').quickReplies, []);
    assert.deepEqual(extractQuickReplies('Can you explain whether light is a wave or a particle?').quickReplies, []);
  });

  test('returns no options when a list has too many (>4) or too-long (>6 words / >40 chars) items or only 1 valid item after dropping pronouns', () => {
    assert.deepEqual(
      extractQuickReplies('Is it Math, Science, English, Hindi, or Social Studies?').quickReplies,
      []
    );
    assert.deepEqual(
      extractQuickReplies('Do you want a quick recap, or should we go back and read the entire first chapter from start to finish?').quickReplies,
      []
    );
    assert.deepEqual(
      extractQuickReplies('Is it Maths or that?').quickReplies,
      []
    );
    assert.deepEqual(
      extractQuickReplies('Is it Maths, Science, or that?').quickReplies,
      ['Maths', 'Science']
    );
  });

  test('skips heuristic extraction when reply contains a QUIZ_ITEM-style quiz and lets explicit tag win over heuristic', () => {
    const quizReply =
      'Question 1 of 3: Which gas do plants release during photosynthesis?\nA) Carbon dioxide\nB) Oxygen\nC) Nitrogen\nIs it A, B, or C?';
    assert.deepEqual(extractQuickReplies(quizReply).quickReplies, []);

    const taggedQuiz =
      'Is it Oxygen or Carbon dioxide?\n[[QUIZ_ITEM {"n":1,"of":3,"question":"Gas?","options":{"A":"Oxygen","B":"Carbon dioxide"},"answer":"A"}]]';
    assert.deepEqual(extractQuickReplies(taggedQuiz).quickReplies, []);

    const tagWins = extractQuickReplies('Is it Math, Science, or maybe something else?\n[[OPTIONS: Algebra | Geometry]]');
    assert.equal(tagWins.text, 'Is it Math, Science, or maybe something else?');
    assert.deepEqual(tagWins.quickReplies, ['Algebra', 'Geometry']);
  });

  test('ensureTurnQuickReplies guarantees contextual options for every follow-up turn even when the question is open-ended', () => {
    // Turn 1 greeting with trailing open question
    const turn1 =
      "Hey Aarav! Ready for some cool Science magic today, or is there a tricky question from class 8 that's bugging you? What’s on your mind?";
    assert.deepEqual(ensureTurnQuickReplies(turn1), ['Cool Science magic', 'Tricky question']);

    // Turn 2 chapter/topic question
    const turn2 =
      'Nice! Science is full of exciting discoveries. What chapter or topic in Science are you working on right now?';
    assert.deepEqual(ensureTurnQuickReplies(turn2), [
      'Photosynthesis',
      'Force & Pressure',
      'Cells',
      'Pick a topic for me'
    ]);

    // Turn 3 open concept-check question
    const turn3 =
      'Photosynthesis is like the plant’s own kitchen, where sunlight, water, and carbon dioxide join forces to cook food and release oxygen. Can you tell me what ingredient plants need from sunlight to start this kitchen magic?';
    assert.deepEqual(ensureTurnQuickReplies(turn3), [
      'Give me a hint',
      'Show an example',
      'Explain simply',
      'Quiz me on this'
    ]);
  });
});
