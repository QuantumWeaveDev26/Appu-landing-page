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
}
