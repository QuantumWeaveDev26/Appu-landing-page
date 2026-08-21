import type { Queryable } from '../../db/types.js';
import { ForbiddenError, NotFoundError } from '../../errors/index.js';
import { TenancyRepository } from '../tenancy/repository.js';
import type { Household, HouseholdMember } from '../tenancy/types.js';

export interface AuthorizedHouseholdContext {
  household: Household;
  member: HouseholdMember;
}

/**
 * HouseholdAuthorizationService derives and validates household access
 * strictly from trusted verified principal userId.
 */
export class HouseholdAuthorizationService {
  /**
   * Retrieves the primary household and active membership for a verified user.
   */
  public static async getPrimaryHouseholdForUser(
    db: Queryable,
    userId: string
  ): Promise<AuthorizedHouseholdContext | null> {
    if (!userId || typeof userId !== 'string') {
      return null;
    }

    const memberships = await TenancyRepository.findMembershipsByUserId(db, userId.trim());
    if (memberships.length === 0) {
      return null;
    }

    // Use primary (first active) membership
    const primaryMembership = memberships[0];
    const household = await TenancyRepository.getHouseholdById(db, primaryMembership.householdId);

    if (!household) {
      return null;
    }

    return {
      household,
      member: primaryMembership
    };
  }

  /**
   * Enforces that the verified user is an authorized member of the target household.
   * If householdId is omitted, resolves and requires the user's primary household.
   *
   * Throws ForbiddenError if user is not a verified member.
   */
  public static async requireHouseholdMembership(
    db: Queryable,
    userId: string,
    householdId?: string
  ): Promise<AuthorizedHouseholdContext> {
    if (!userId || typeof userId !== 'string') {
      throw new ForbiddenError('Invalid user authorization identity');
    }

    const trimmedUserId = userId.trim();

    if (householdId && typeof householdId === 'string' && householdId.trim().length > 0) {
      const trimmedHouseholdId = householdId.trim();
      const membership = await TenancyRepository.findMembership(db, trimmedHouseholdId, trimmedUserId);

      if (!membership) {
        throw new ForbiddenError('User is not authorized to access this household');
      }

      const household = await TenancyRepository.getHouseholdById(db, trimmedHouseholdId);
      if (!household) {
        throw new NotFoundError('Household not found');
      }

      return {
        household,
        member: membership
      };
    }

    // Resolve primary household membership
    const context = await this.getPrimaryHouseholdForUser(db, trimmedUserId);
    if (!context) {
      throw new ForbiddenError('User has no active household. Please complete onboarding first.');
    }

    return context;
  }
}
