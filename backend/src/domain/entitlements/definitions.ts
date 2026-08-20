import {
  InitialEntitlementKeys,
  type EntitlementDefinition
} from './types.js';

export const INITIAL_ENTITLEMENT_DEFINITIONS: Readonly<Record<string, EntitlementDefinition>> = {
  [InitialEntitlementKeys.MAX_CHILDREN]: {
    key: InitialEntitlementKeys.MAX_CHILDREN,
    type: 'integer',
    defaultValue: 1,
    min: 1,
    unit: 'count',
    description: 'Maximum number of child profiles permitted in the household'
  },
  [InitialEntitlementKeys.MONTHLY_VOICE_MINUTES]: {
    key: InitialEntitlementKeys.MONTHLY_VOICE_MINUTES,
    type: 'integer',
    defaultValue: 0,
    min: 0,
    unit: 'minutes',
    description: 'Monthly voice conversation quota allocated to the subscription'
  },
  [InitialEntitlementKeys.MONTHLY_AI_SESSIONS]: {
    key: InitialEntitlementKeys.MONTHLY_AI_SESSIONS,
    type: 'integer',
    defaultValue: 0,
    min: 0,
    unit: 'sessions',
    description: 'Monthly AI interactive learning sessions allocated to the subscription'
  },
  [InitialEntitlementKeys.MULTILINGUAL]: {
    key: InitialEntitlementKeys.MULTILINGUAL,
    type: 'boolean',
    defaultValue: false,
    description: 'Enables multilingual Appu mentor voice and dialogue in regional languages'
  },
  [InitialEntitlementKeys.ADVANCED_PERSONALISATION]: {
    key: InitialEntitlementKeys.ADVANCED_PERSONALISATION,
    type: 'boolean',
    defaultValue: false,
    description: 'Enables advanced adaptive learning path and pedagogical explanation styles'
  },
  [InitialEntitlementKeys.PARENT_REPORTS]: {
    key: InitialEntitlementKeys.PARENT_REPORTS,
    type: 'boolean',
    defaultValue: false,
    description: 'Enables weekly/monthly parent learning insight summaries and topic analytics'
  },
  [InitialEntitlementKeys.LONG_TERM_CONTEXT]: {
    key: InitialEntitlementKeys.LONG_TERM_CONTEXT,
    type: 'boolean',
    defaultValue: false,
    description: 'Enables cross-session educational memory and persistent learning facts'
  },
  [InitialEntitlementKeys.PREMIUM_THEMES]: {
    key: InitialEntitlementKeys.PREMIUM_THEMES,
    type: 'boolean',
    defaultValue: false,
    description: 'Enables premium Appu visual themes, avatar outfits, and card styles'
  }
};

/**
 * Returns the definition for a given entitlement key if registered.
 */
export function getEntitlementDefinition(key: string): EntitlementDefinition | undefined {
  return INITIAL_ENTITLEMENT_DEFINITIONS[key];
}

/**
 * Returns all initial entitlement definitions as an array.
 */
export function getAllEntitlementDefinitions(): readonly EntitlementDefinition[] {
  return Object.values(INITIAL_ENTITLEMENT_DEFINITIONS);
}
