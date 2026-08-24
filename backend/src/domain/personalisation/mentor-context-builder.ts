import type { Queryable } from '../../db/types.js';
import { NotFoundError } from '../../errors/index.js';
import type { EntitlementsMap } from '../entitlements/types.js';
import { TenancyRepository } from '../tenancy/repository.js';
import { PersonalisationRepository } from './repository.js';
import type { AuthenticatedMentorContext } from './types.js';

/**
 * Builds the canonical, mentor-facing context from authoritative tenant-scoped data.
 * A new context is loaded and created for every authenticated mentor request.
 */
export class MentorContextBuilder {
  public static async buildMentorContext(
    db: Queryable,
    householdId: string,
    childId: string,
    entitlements: EntitlementsMap | null
  ): Promise<AuthenticatedMentorContext> {
    const child = await TenancyRepository.getChildProfile(db, householdId, childId);
    if (!child) {
      throw new NotFoundError(`Child profile '${childId}' not found in household`);
    }

    const personalisation = await PersonalisationRepository.getPersonalisation(
      db,
      householdId,
      childId
    );

    const multilingualEnabled = Boolean(entitlements?.multilingual ?? false);

    return {
      mode: 'authenticated',
      learnerId: child.id,
      learnerName: child.preferredName,
      grade: child.gradeBand,
      primaryLanguage: multilingualEnabled
        ? (personalisation?.preferredLanguage ?? 'en')
        : 'en',
      learningStyle: personalisation?.learningStyle ?? 'visual',
      responseStyle: personalisation?.responseStyle ?? 'playful',
      favoriteSubjects: personalisation?.favoriteSubjects ?? [],
      interests: personalisation?.interests ?? [],
      learningGoals: personalisation?.goals ?? [],
      personalizationEnabled: personalisation !== null,
      advancedPersonalizationEnabled: Boolean(
        entitlements?.advanced_personalisation ?? false
      ),
      longTermContextEnabled: Boolean(entitlements?.long_term_context ?? false)
    };
  }
}
