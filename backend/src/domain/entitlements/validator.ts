import { InvalidEntitlementValueError } from '../../errors/app-error.js';
import { getEntitlementDefinition } from './definitions.js';
import type {
  EntitlementDefinition,
  EntitlementValue,
  EntitlementsMap
} from './types.js';

/**
 * Validates a single entitlement value against its definition.
 * Pure type/range validation without plan-name conditions.
 */
export function validateEntitlementValue(
  key: string,
  value: unknown,
  customDef?: EntitlementDefinition
): EntitlementValue {
  const definition = customDef ?? getEntitlementDefinition(key);

  if (!definition) {
    throw new InvalidEntitlementValueError(
      key,
      'registered entitlement definition',
      value,
      'Entitlement keys must be registered before values can be accepted'
    );
  }

  switch (definition.type) {
    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw new InvalidEntitlementValueError(key, 'boolean', value);
      }
      return value;
    }

    case 'integer': {
      if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        throw new InvalidEntitlementValueError(key, 'safe integer', value, 'Value must be a safe integer number');
      }
      if (definition.min !== undefined && value < definition.min) {
        throw new InvalidEntitlementValueError(
          key,
          `integer >= ${definition.min}`,
          value,
          `Value ${value} is below the minimum allowed (${definition.min})`
        );
      }
      if (definition.max !== undefined && value > definition.max) {
        throw new InvalidEntitlementValueError(
          key,
          `integer <= ${definition.max}`,
          value,
          `Value ${value} exceeds the maximum allowed (${definition.max})`
        );
      }
      return value;
    }

    case 'string': {
      if (typeof value !== 'string' || value.trim().length === 0) {
        throw new InvalidEntitlementValueError(key, 'non-empty string', value);
      }
      if (definition.allowedValues && !definition.allowedValues.includes(value)) {
        throw new InvalidEntitlementValueError(
          key,
          `one of [${definition.allowedValues.join(', ')}]`,
          value,
          `Value '${value}' is not in the allowed values list`
        );
      }
      return value;
    }

    default: {
      throw new InvalidEntitlementValueError(key, 'supported entitlement type', value);
    }
  }
}

/**
 * Validates a map of entitlement key-value pairs.
 */
export function validateEntitlementsMap(
  rawMap: Record<string, unknown>,
  definitions: Readonly<Record<string, EntitlementDefinition>> = {}
): EntitlementsMap {
  const validated: EntitlementsMap = {};

  for (const [key, value] of Object.entries(rawMap)) {
    const def = definitions[key] ?? getEntitlementDefinition(key);
    validated[key] = validateEntitlementValue(key, value, def);
  }

  return validated;
}
