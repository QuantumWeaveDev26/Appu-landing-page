import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SubscriptionStates,
  ALL_SUBSCRIPTION_STATES,
  canTransition,
  validateTransition,
  getAllowedTransitions,
  isEntitledState,
  isTerminalState,
  type SubscriptionState
} from '../src/domain/subscription/index.js';
import { InvalidStateTransitionError } from '../src/errors/app-error.js';

test('defines all 9 required subscription states', () => {
  const expectedStates = [
    'DRAFT',
    'PENDING_PAYMENT',
    'AUTHENTICATED',
    'ACTIVE',
    'PAST_DUE',
    'HALTED',
    'PAUSED',
    'CANCELLED',
    'EXPIRED'
  ];

  assert.equal(ALL_SUBSCRIPTION_STATES.length, 9);
  for (const state of expectedStates) {
    assert.ok(
      ALL_SUBSCRIPTION_STATES.includes(state as SubscriptionState),
      `Expected state ${state} to be in SubscriptionStates`
    );
  }
});

test('valid subscription state transitions are permitted', () => {
  const validTransitions: [SubscriptionState, SubscriptionState][] = [
    // From DRAFT
    [SubscriptionStates.DRAFT, SubscriptionStates.PENDING_PAYMENT],
    [SubscriptionStates.DRAFT, SubscriptionStates.CANCELLED],
    [SubscriptionStates.DRAFT, SubscriptionStates.EXPIRED],

    // From PENDING_PAYMENT
    [SubscriptionStates.PENDING_PAYMENT, SubscriptionStates.AUTHENTICATED],
    [SubscriptionStates.PENDING_PAYMENT, SubscriptionStates.ACTIVE],
    [SubscriptionStates.PENDING_PAYMENT, SubscriptionStates.CANCELLED],
    [SubscriptionStates.PENDING_PAYMENT, SubscriptionStates.EXPIRED],

    // From AUTHENTICATED
    [SubscriptionStates.AUTHENTICATED, SubscriptionStates.ACTIVE],
    [SubscriptionStates.AUTHENTICATED, SubscriptionStates.PAST_DUE],
    [SubscriptionStates.AUTHENTICATED, SubscriptionStates.CANCELLED],
    [SubscriptionStates.AUTHENTICATED, SubscriptionStates.EXPIRED],

    // From ACTIVE
    [SubscriptionStates.ACTIVE, SubscriptionStates.PAST_DUE],
    [SubscriptionStates.ACTIVE, SubscriptionStates.PAUSED],
    [SubscriptionStates.ACTIVE, SubscriptionStates.HALTED],
    [SubscriptionStates.ACTIVE, SubscriptionStates.CANCELLED],
    [SubscriptionStates.ACTIVE, SubscriptionStates.EXPIRED],

    // From PAST_DUE
    [SubscriptionStates.PAST_DUE, SubscriptionStates.ACTIVE],
    [SubscriptionStates.PAST_DUE, SubscriptionStates.HALTED],
    [SubscriptionStates.PAST_DUE, SubscriptionStates.PAUSED],
    [SubscriptionStates.PAST_DUE, SubscriptionStates.CANCELLED],
    [SubscriptionStates.PAST_DUE, SubscriptionStates.EXPIRED],

    // From HALTED
    [SubscriptionStates.HALTED, SubscriptionStates.ACTIVE],
    [SubscriptionStates.HALTED, SubscriptionStates.CANCELLED],
    [SubscriptionStates.HALTED, SubscriptionStates.EXPIRED],

    // From PAUSED
    [SubscriptionStates.PAUSED, SubscriptionStates.ACTIVE],
    [SubscriptionStates.PAUSED, SubscriptionStates.CANCELLED],
    [SubscriptionStates.PAUSED, SubscriptionStates.EXPIRED],

    // From CANCELLED
    [SubscriptionStates.CANCELLED, SubscriptionStates.EXPIRED]
  ];

  for (const [from, to] of validTransitions) {
    assert.equal(
      canTransition(from, to),
      true,
      `Expected transition ${from} -> ${to} to be allowed`
    );
    assert.doesNotThrow(
      () => validateTransition(from, to),
      `Expected validateTransition(${from}, ${to}) not to throw`
    );
  }
});

test('invalid subscription state transitions are rejected with InvalidStateTransitionError', () => {
  const invalidTransitions: [SubscriptionState, SubscriptionState][] = [
    // Disallowed jumps from DRAFT
    [SubscriptionStates.DRAFT, SubscriptionStates.ACTIVE],
    [SubscriptionStates.DRAFT, SubscriptionStates.PAST_DUE],
    [SubscriptionStates.DRAFT, SubscriptionStates.HALTED],
    [SubscriptionStates.DRAFT, SubscriptionStates.PAUSED],
    [SubscriptionStates.DRAFT, SubscriptionStates.AUTHENTICATED],

    // Disallowed backward transitions to DRAFT
    [SubscriptionStates.ACTIVE, SubscriptionStates.DRAFT],
    [SubscriptionStates.PAST_DUE, SubscriptionStates.DRAFT],
    [SubscriptionStates.AUTHENTICATED, SubscriptionStates.DRAFT],
    [SubscriptionStates.PENDING_PAYMENT, SubscriptionStates.DRAFT],

    // Disallowed transitions out of EXPIRED (terminal)
    [SubscriptionStates.EXPIRED, SubscriptionStates.ACTIVE],
    [SubscriptionStates.EXPIRED, SubscriptionStates.DRAFT],
    [SubscriptionStates.EXPIRED, SubscriptionStates.PENDING_PAYMENT],
    [SubscriptionStates.EXPIRED, SubscriptionStates.CANCELLED],

    // Disallowed reactivations from CANCELLED (must transition to EXPIRED, not back to ACTIVE)
    [SubscriptionStates.CANCELLED, SubscriptionStates.ACTIVE],
    [SubscriptionStates.CANCELLED, SubscriptionStates.PAST_DUE],
    [SubscriptionStates.CANCELLED, SubscriptionStates.DRAFT],

    // Disallowed self-transitions
    [SubscriptionStates.DRAFT, SubscriptionStates.DRAFT],
    [SubscriptionStates.ACTIVE, SubscriptionStates.ACTIVE],
    [SubscriptionStates.EXPIRED, SubscriptionStates.EXPIRED]
  ];

  for (const [from, to] of invalidTransitions) {
    assert.equal(
      canTransition(from, to),
      false,
      `Expected transition ${from} -> ${to} to be disallowed`
    );

    assert.throws(
      () => validateTransition(from, to),
      (err) => {
        return (
          err instanceof InvalidStateTransitionError &&
          err.code === 'invalid_state_transition' &&
          err.statusCode === 422 &&
          err.details?.fromState === from &&
          err.details?.toState === to
        );
      },
      `Expected validateTransition(${from}, ${to}) to throw InvalidStateTransitionError`
    );
  }
});

test('getAllowedTransitions returns correct list per state', () => {
  assert.deepEqual(getAllowedTransitions(SubscriptionStates.CANCELLED), ['EXPIRED']);
  assert.deepEqual(getAllowedTransitions(SubscriptionStates.EXPIRED), []);
  assert.ok(getAllowedTransitions(SubscriptionStates.ACTIVE).length > 0);
});

test('isEntitledState returns true only for ACTIVE state', () => {
  for (const state of ALL_SUBSCRIPTION_STATES) {
    if (state === SubscriptionStates.ACTIVE) {
      assert.equal(isEntitledState(state), true);
    } else {
      assert.equal(isEntitledState(state), false, `State ${state} should not be entitled`);
    }
  }
});

test('isTerminalState returns true only for EXPIRED state', () => {
  for (const state of ALL_SUBSCRIPTION_STATES) {
    if (state === SubscriptionStates.EXPIRED) {
      assert.equal(isTerminalState(state), true);
    } else {
      assert.equal(isTerminalState(state), false, `State ${state} should not be terminal`);
    }
  }
});
