import test from 'node:test';
import assert from 'node:assert/strict';
import { onePerPhone } from '../src/domain/whatsapp/proactive/service.js';

test('daily tip / weekly digest targets: one per phone number, oldest child kept', () => {
  const targets = [
    { parentPhone: '+91 97405 95677', childId: 'navee-1' },
    { parentPhone: '9740595677', childId: 'sura' },
    { parentPhone: '919740595677', childId: 'navee-2' },
    { parentPhone: '0091 98450 00000', childId: 'other' },
    { parentPhone: '', childId: 'no-phone' }
  ];
  assert.deepEqual(onePerPhone(targets).map((t) => t.childId), ['navee-1', 'other']);
});
