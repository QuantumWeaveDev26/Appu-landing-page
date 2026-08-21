import { InvalidStateTransitionError } from '../../errors/app-error.js';
import { SubscriptionStates, type SubscriptionState } from './types.js';

/**
 * Explicit allowed transitions mapping for Appu Phase 2 Subscription State Machine.
 * Any transition not in this map is strictly disallowed.
 */
export const ALLOWED_SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionState, readonly SubscriptionState[]>> = {
  [SubscriptionStates.DRAFT]: [
    SubscriptionStates.PENDING_PAYMENT,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.PENDING_PAYMENT]: [
    SubscriptionStates.AUTHENTICATED,
    SubscriptionStates.ACTIVE,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.AUTHENTICATED]: [
    SubscriptionStates.ACTIVE,
    SubscriptionStates.PAST_DUE,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.ACTIVE]: [
    SubscriptionStates.PAST_DUE,
    SubscriptionStates.PAUSED,
    SubscriptionStates.HALTED,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.PAST_DUE]: [
    SubscriptionStates.ACTIVE,
    SubscriptionStates.HALTED,
    SubscriptionStates.PAUSED,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.HALTED]: [
    SubscriptionStates.ACTIVE,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.PAUSED]: [
    SubscriptionStates.ACTIVE,
    SubscriptionStates.CANCELLED,
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.CANCELLED]: [
    SubscriptionStates.EXPIRED
  ],
  [SubscriptionStates.EXPIRED]: []
};

/**
 * Returns the list of valid next states from a given state.
 */
export function getAllowedTransitions(fromState: SubscriptionState): readonly SubscriptionState[] {
  return ALLOWED_SUBSCRIPTION_TRANSITIONS[fromState] ?? [];
}

/**
 * Checks whether a transition from `fromState` to `toState` is allowed.
 */
export function canTransition(fromState: SubscriptionState, toState: SubscriptionState): boolean {
  if (fromState === toState) {
    return false; // No self-transitions
  }
  const allowed = ALLOWED_SUBSCRIPTION_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

/**
 * Validates a transition and throws `InvalidStateTransitionError` if not allowed.
 */
export function validateTransition(fromState: SubscriptionState, toState: SubscriptionState): void {
  if (!canTransition(fromState, toState)) {
    const allowed = getAllowedTransitions(fromState);
    const reason = allowed.length === 0
      ? `'${fromState}' is a terminal state with no outgoing transitions`
      : `Allowed target states from '${fromState}' are: [${allowed.join(', ')}]`;

    throw new InvalidStateTransitionError(fromState, toState, reason);
  }
}

/**
 * Returns true if the subscription state grants standard paid entitlements.
 */
export function isEntitledState(state: SubscriptionState): boolean {
  return state === SubscriptionStates.ACTIVE;
}

/**
 * Returns true if the subscription state is terminal (no further transitions possible).
 */
export function isTerminalState(state: SubscriptionState): boolean {
  return state === SubscriptionStates.EXPIRED;
}

/**
 * SubscriptionStateMachine utility wrapper.
 */
export class SubscriptionStateMachine {
  public static getAllowedTransitions = getAllowedTransitions;
  public static canTransition = canTransition;
  public static validateTransition = validateTransition;
  public static isEntitledState = isEntitledState;
  public static isTerminalState = isTerminalState;
}
