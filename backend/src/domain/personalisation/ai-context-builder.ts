import type { Queryable } from '../../db/types.js';
import { NotFoundError } from '../../errors/index.js';
import { TenancyRepository } from '../tenancy/repository.js';
import { PersonalisationRepository } from './repository.js';
import type { ChildAIContext } from './types.js';
import type { EntitlementsMap } from '../entitlements/types.js';

export class AIContextBuilder {
  /**
   * Builds a safe, structured, server-owned AI context for a child session.
   * Personalisation values are treated strictly as data, never as executable instructions.
   */
  public static async buildChildAIContext(
    db: Queryable,
    householdId: string,
    childId: string,
    entitlements: EntitlementsMap | null
  ): Promise<ChildAIContext> {
    const child = await TenancyRepository.getChildProfile(db, householdId, childId);
    if (!child) {
      throw new NotFoundError(`Child profile '${childId}' not found in household`);
    }

    const personalisation = await PersonalisationRepository.getPersonalisation(
      db,
      householdId,
      childId
    );

    // Resolve entitlements flags server-side
    const multilingual = Boolean(entitlements?.multilingual ?? false);
    const advancedPersonalisation = Boolean(entitlements?.advanced_personalisation ?? false);
    const longTermContext = Boolean(entitlements?.long_term_context ?? false);

    // Fallbacks if personalisation is not yet configured
    const preferredLanguage = personalisation?.preferredLanguage ?? 'en';
    const favoriteColor = personalisation?.favoriteColor ?? null;
    const fontPreference = personalisation?.fontPreference ?? 'friendly';
    const learningStyle = personalisation?.learningStyle ?? 'visual';
    const interests = personalisation?.interests ?? [];
    const favoriteSubjects = personalisation?.favoriteSubjects ?? [];
    const goals = personalisation?.goals ?? [];
    const responseStyle = personalisation?.responseStyle ?? 'playful';
    const themePreference = personalisation?.themePreference ?? 'auto';

    return {
      child: {
        id: child.id,
        preferredName: child.preferredName,
        gradeBand: child.gradeBand
      },
      preferences: {
        language: multilingual ? preferredLanguage : 'en',
        learningStyle,
        interests,
        favoriteSubjects,
        goals,
        responseStyle
      },
      presentation: {
        favoriteColor,
        fontPreference,
        themePreference
      },
      entitlements: {
        multilingual,
        advancedPersonalisation,
        longTermContext
      }
    };
  }
}
