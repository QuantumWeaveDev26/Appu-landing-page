import type { TransactionalQueryable } from '../../db/types.js';
import { TenancyRepository } from './repository.js';
import { HouseholdRoles, type Household, type HouseholdMember } from './types.js';

export interface CreateHouseholdWithOwnerInput {
  /**
   * Trusted authenticated parent user identifier.
   * SECURITY INVARIANT: Must be a verified server-side user ID supplied
   * by the authentication layer, NEVER an unverified browser-supplied value.
   */
  userId: string;
  householdName?: string | null;
}

export interface CreateHouseholdWithOwnerResult {
  household: Household;
  owner: HouseholdMember;
}

export interface OnboardParentResult {
  household: Household;
  member: HouseholdMember;
  isNew: boolean;
}

/**
 * TenancyService encapsulates multi-entity tenant transactions.
 */
export class TenancyService {
  /**
   * Atomically creates a Household and its initial OWNER membership in a single transaction.
   *
   * TRANSACTION INVARIANT:
   * A household must NEVER be persisted without an initial OWNER. If membership creation fails
   * (e.g. invalid userId or DB error), the entire transaction rolls back cleanly.
   */
  public static async createHouseholdWithOwner(
    db: TransactionalQueryable,
    input: CreateHouseholdWithOwnerInput
  ): Promise<CreateHouseholdWithOwnerResult> {
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim().length === 0) {
      throw new Error('Valid userId is required to create a household with an initial owner');
    }

    return db.transaction(async (txDb) => {
      // 1. Create the household root entity
      const household = await TenancyRepository.createHousehold(txDb, {
        name: input.householdName ?? null
      });

      // 2. Create the initial OWNER membership
      const owner = await TenancyRepository.createHouseholdMember(txDb, {
        householdId: household.id,
        userId: input.userId.trim(),
        role: HouseholdRoles.OWNER
      });

      return {
        household,
        owner
      };
    });
  }

  /**
   * Idempotently onboards a parent into their household.
   *
   * If the authenticated parent already belongs to a household, returns the existing
   * household and membership without creating an accidental duplicate household.
   * If the parent has no household, atomically creates one with OWNER role.
   */
  public static async onboardParentHousehold(
    db: TransactionalQueryable,
    input: CreateHouseholdWithOwnerInput
  ): Promise<OnboardParentResult> {
    if (!input.userId || typeof input.userId !== 'string' || input.userId.trim().length === 0) {
      throw new Error('Valid userId is required for parent onboarding');
    }

    const trimmedUserId = input.userId.trim();

    // Check for existing membership first (idempotent retry safety)
    const existingMemberships = await TenancyRepository.findMembershipsByUserId(db, trimmedUserId);
    if (existingMemberships.length > 0) {
      const primaryMembership = existingMemberships[0];
      const household = await TenancyRepository.getHouseholdById(db, primaryMembership.householdId);

      if (household) {
        return {
          household,
          member: primaryMembership,
          isNew: false
        };
      }
    }

    // No existing household membership found, perform atomic creation
    const { household, owner } = await TenancyService.createHouseholdWithOwner(db, {
      userId: trimmedUserId,
      householdName: input.householdName
    });

    return {
      household,
      member: owner,
      isNew: true
    };
  }
}
