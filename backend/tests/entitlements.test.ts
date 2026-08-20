import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InitialEntitlementKeys,
  INITIAL_ENTITLEMENT_DEFINITIONS,
  getEntitlementDefinition,
  getAllEntitlementDefinitions,
  validateEntitlementValue,
  validateEntitlementsMap,
  EntitlementResolver,
  type EntitlementsMap
} from '../src/domain/entitlements/index.js';
import { InvalidEntitlementValueError } from '../src/errors/app-error.js';

test('defines all 8 required initial entitlement keys with correct types and metadata', () => {
  const expectedKeys = [
    InitialEntitlementKeys.MAX_CHILDREN,
    InitialEntitlementKeys.MONTHLY_VOICE_MINUTES,
    InitialEntitlementKeys.MONTHLY_AI_SESSIONS,
    InitialEntitlementKeys.MULTILINGUAL,
    InitialEntitlementKeys.ADVANCED_PERSONALISATION,
    InitialEntitlementKeys.PARENT_REPORTS,
    InitialEntitlementKeys.LONG_TERM_CONTEXT,
    InitialEntitlementKeys.PREMIUM_THEMES
  ];

  const allDefs = getAllEntitlementDefinitions();
  assert.equal(allDefs.length, 8);

  for (const key of expectedKeys) {
    const def = getEntitlementDefinition(key);
    assert.ok(def, `Entitlement key '${key}' must be defined`);
    assert.equal(def.key, key);
    assert.ok(typeof def.description === 'string' && def.description.length > 0);
  }

  // Check specific types
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MAX_CHILDREN)?.type, 'integer');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MAX_CHILDREN)?.min, 1);

  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES)?.type, 'integer');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES)?.min, 0);

  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MONTHLY_AI_SESSIONS)?.type, 'integer');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MONTHLY_AI_SESSIONS)?.min, 0);

  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.MULTILINGUAL)?.type, 'boolean');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.ADVANCED_PERSONALISATION)?.type, 'boolean');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.PARENT_REPORTS)?.type, 'boolean');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.LONG_TERM_CONTEXT)?.type, 'boolean');
  assert.equal(getEntitlementDefinition(InitialEntitlementKeys.PREMIUM_THEMES)?.type, 'boolean');
});

test('validates boolean entitlement values correctly', () => {
  assert.equal(validateEntitlementValue(InitialEntitlementKeys.MULTILINGUAL, true), true);
  assert.equal(validateEntitlementValue(InitialEntitlementKeys.MULTILINGUAL, false), false);

  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MULTILINGUAL, 'true'),
    (err) => err instanceof InvalidEntitlementValueError && err.details?.expectedType === 'boolean'
  );

  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MULTILINGUAL, 1),
    (err) => err instanceof InvalidEntitlementValueError
  );

  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MULTILINGUAL, null),
    (err) => err instanceof InvalidEntitlementValueError
  );
});

test('validates integer entitlement values correctly with min bounds', () => {
  assert.equal(validateEntitlementValue(InitialEntitlementKeys.MAX_CHILDREN, 1), 1);
  assert.equal(validateEntitlementValue(InitialEntitlementKeys.MAX_CHILDREN, 5), 5);

  assert.equal(validateEntitlementValue(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES, 0), 0);
  assert.equal(validateEntitlementValue(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES, 120), 120);

  // max_children has min: 1, so 0 is invalid
  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MAX_CHILDREN, 0),
    (err) => err instanceof InvalidEntitlementValueError
  );

  // monthly_voice_minutes has min: 0, so -1 is invalid
  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES, -10),
    (err) => err instanceof InvalidEntitlementValueError
  );

  // Floats are invalid for integer entitlements
  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES, 15.5),
    (err) => err instanceof InvalidEntitlementValueError
  );

  // Strings are invalid for integer entitlements
  assert.throws(
    () => validateEntitlementValue(InitialEntitlementKeys.MONTHLY_VOICE_MINUTES, '60'),
    (err) => err instanceof InvalidEntitlementValueError
  );

  // Integers outside JavaScript's safe range cannot be stored or compared reliably
  assert.throws(
    () => validateEntitlementValue(
      InitialEntitlementKeys.MONTHLY_VOICE_MINUTES,
      Number.MAX_SAFE_INTEGER + 1
    ),
    (err) => err instanceof InvalidEntitlementValueError
  );
});

test('validates custom string entitlement values correctly', () => {
  const customStringDef = {
    key: 'custom_tier',
    type: 'string' as const,
    defaultValue: 'standard',
    description: 'Custom string tier',
    allowedValues: ['standard', 'accelerated', 'custom'] as const
  };

  assert.equal(validateEntitlementValue('custom_tier', 'standard', customStringDef), 'standard');
  assert.equal(validateEntitlementValue('custom_tier', 'accelerated', customStringDef), 'accelerated');

  // Disallowed string value
  assert.throws(
    () => validateEntitlementValue('custom_tier', 'invalid_tier', customStringDef),
    (err) => err instanceof InvalidEntitlementValueError
  );

  // Empty string is invalid
  assert.throws(
    () => validateEntitlementValue('custom_tier', '', customStringDef),
    (err) => err instanceof InvalidEntitlementValueError
  );

  // Non-string is invalid
  assert.throws(
    () => validateEntitlementValue('custom_tier', 123, customStringDef),
    (err) => err instanceof InvalidEntitlementValueError
  );
});

test('validateEntitlementsMap validates and returns a clean map of typed values', () => {
  const input = {
    max_children: 3,
    monthly_voice_minutes: 60,
    monthly_ai_sessions: 30,
    multilingual: true,
    advanced_personalisation: true,
    parent_reports: true,
    long_term_context: false,
    premium_themes: true
  };

  const validated = validateEntitlementsMap(input);
  assert.deepEqual(validated, input);
});

test('validateEntitlementsMap throws when any key has an invalid value', () => {
  const invalidInput = {
    max_children: 2,
    monthly_voice_minutes: -5 // Invalid negative integer
  };

  assert.throws(
    () => validateEntitlementsMap(invalidInput),
    (err) => err instanceof InvalidEntitlementValueError && err.details?.key === 'monthly_voice_minutes'
  );
});

test('validateEntitlementsMap rejects entitlement keys without a registered definition', () => {
  assert.throws(
    () => validateEntitlementsMap({ frontend_granted_voice: true }),
    (err) => (
      err instanceof InvalidEntitlementValueError &&
      err.details?.key === 'frontend_granted_voice'
    )
  );
});

test('EntitlementResolver merges layers without plan-name string conditionals', () => {
  // Layer 1: Plan base entitlement values
  const planDefaultsLayer = {
    name: 'plan_tier_values',
    values: {
      max_children: 2,
      monthly_voice_minutes: 30,
      monthly_ai_sessions: 20,
      multilingual: true,
      advanced_personalisation: false,
      parent_reports: true,
      long_term_context: false,
      premium_themes: false
    }
  };

  // Layer 2: Promotional trial grant layer
  const promotionalLayer = {
    name: 'promotional_trial_grant',
    values: {
      advanced_personalisation: true,
      monthly_voice_minutes: 60
    }
  };

  // Layer 3: Admin override layer
  const adminOverrideLayer = {
    name: 'admin_support_override',
    values: {
      max_children: 3,
      premium_themes: true
    }
  };

  const effective = EntitlementResolver.resolve([
    planDefaultsLayer,
    promotionalLayer,
    adminOverrideLayer
  ]);

  // Evaluated by value precedence, not by plan === "premium":
  assert.equal(EntitlementResolver.getNumericLimit(effective, 'max_children'), 3); // Overridden by admin
  assert.equal(EntitlementResolver.getNumericLimit(effective, 'monthly_voice_minutes'), 60); // Overridden by promo
  assert.equal(EntitlementResolver.getNumericLimit(effective, 'monthly_ai_sessions'), 20); // From plan defaults
  assert.equal(EntitlementResolver.can(effective, 'multilingual'), true); // From plan defaults
  assert.equal(EntitlementResolver.can(effective, 'advanced_personalisation'), true); // From promo
  assert.equal(EntitlementResolver.can(effective, 'parent_reports'), true); // From plan defaults
  assert.equal(EntitlementResolver.can(effective, 'long_term_context'), false); // Base default
  assert.equal(EntitlementResolver.can(effective, 'premium_themes'), true); // From admin
});

test('EntitlementResolver rejects invalid runtime values before applying an override', () => {
  const invalidRuntimeLayer = {
    name: 'database_override',
    values: {
      monthly_voice_minutes: -1
    }
  };

  assert.throws(
    () => EntitlementResolver.resolve([invalidRuntimeLayer]),
    (err) => (
      err instanceof InvalidEntitlementValueError &&
      err.details?.key === InitialEntitlementKeys.MONTHLY_VOICE_MINUTES
    )
  );
});

test('EntitlementResolver can(), getNumericLimit(), and getStringValue() return safe fallbacks', () => {
  const emptyEntitlements: EntitlementsMap = {};

  assert.equal(EntitlementResolver.can(emptyEntitlements, 'non_existent_bool'), false);
  assert.equal(EntitlementResolver.getNumericLimit(emptyEntitlements, 'non_existent_num', 10), 10);
  assert.equal(EntitlementResolver.getStringValue(emptyEntitlements, 'non_existent_str', 'default_val'), 'default_val');
});
