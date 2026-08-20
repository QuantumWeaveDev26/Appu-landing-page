import {
  INITIAL_ENTITLEMENT_DEFINITIONS
} from './definitions.js';
import { validateEntitlementValue } from './validator.js';
import type {
  EntitlementsMap
} from './types.js';

export interface EntitlementResolutionLayer {
  name: string;
  values: EntitlementsMap;
}

/**
 * EntitlementResolver provides pure, auditable evaluation of effective entitlement values
 * across multiple layers without plan-name string conditionals.
 */
export class EntitlementResolver {
  /**
   * Resolves effective entitlements by merging layers in precedence order:
   * Layer 0: System defaults (from definitions)
   * Layer 1: Plan default entitlements
   * Layer 2: Subscription grandfathered snapshot
   * Layer 3: Promotional / trial grants
   * Layer 4: Add-on grants
   * Layer 5: Administrative overrides (highest precedence)
   */
  public static resolve(layers: readonly EntitlementResolutionLayer[]): EntitlementsMap {
    const effective: EntitlementsMap = {};

    // 1. Seed with system definition default values
    for (const [key, def] of Object.entries(INITIAL_ENTITLEMENT_DEFINITIONS)) {
      effective[key] = def.defaultValue;
    }

    // 2. Overlay each resolution layer in order
    for (const layer of layers) {
      for (const [key, val] of Object.entries(layer.values)) {
        effective[key] = validateEntitlementValue(key, val);
      }
    }

    return effective;
  }

  /**
   * Checks if a boolean entitlement is enabled.
   */
  public static can(entitlements: EntitlementsMap, key: string): boolean {
    const val = entitlements[key];
    return typeof val === 'boolean' ? val : false;
  }

  /**
   * Gets a numeric limit for a quota/count entitlement.
   */
  public static getNumericLimit(
    entitlements: EntitlementsMap,
    key: string,
    fallback = 0
  ): number {
    const val = entitlements[key];
    return typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  }

  /**
   * Gets a string value for an entitlement.
   */
  public static getStringValue(
    entitlements: EntitlementsMap,
    key: string,
    fallback = ''
  ): string {
    const val = entitlements[key];
    return typeof val === 'string' ? val : fallback;
  }
}
