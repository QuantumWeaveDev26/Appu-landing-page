import type { Queryable } from '../../db/types.js';
import { BadRequestError } from '../../errors/index.js';
import { FamilyFeedbackRepository } from './repository.js';
import type {
  FeedbackStatusResponse,
  SubmitFeedbackInput,
  SubmitFeedbackResponse
} from './types.js';

export class FamilyFeedbackService {
  /**
   * Submits structured parent feedback for a household, unlocking performance reports.
   */
  static async saveFeedback(
    db: Queryable,
    householdId: string,
    input: SubmitFeedbackInput
  ): Promise<SubmitFeedbackResponse> {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestError('Rating must be an integer between 1 and 5');
    }

    const feedback = await FamilyFeedbackRepository.createFeedback(db, householdId, input);

    return {
      reportsUnlocked: true,
      feedback: {
        id: feedback.id,
        householdId: feedback.householdId,
        rating: feedback.rating,
        whatsWorking: feedback.whatsWorking,
        whatsToImprove: feedback.whatsToImprove,
        createdAt: feedback.createdAt.toISOString()
      }
    };
  }

  /**
   * Retrieves feedback status and unlock state for a household.
   */
  static async getStatus(
    db: Queryable,
    householdId: string
  ): Promise<FeedbackStatusResponse> {
    const feedback = await FamilyFeedbackRepository.getLatestFeedback(db, householdId);

    if (!feedback) {
      return {
        submitted: false,
        reportsUnlocked: false,
        feedback: null
      };
    }

    return {
      submitted: true,
      reportsUnlocked: true,
      feedback: {
        id: feedback.id,
        rating: feedback.rating,
        whatsWorking: feedback.whatsWorking,
        whatsToImprove: feedback.whatsToImprove,
        createdAt: feedback.createdAt.toISOString()
      }
    };
  }

  /**
   * Fast check whether the household has unlocked performance reports via feedback.
   */
  static async hasFamilyFeedback(
    db: Queryable,
    householdId: string
  ): Promise<boolean> {
    return FamilyFeedbackRepository.hasFamilyFeedback(db, householdId);
  }
}
