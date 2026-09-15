import type { Queryable } from '../../db/types.js';
import { BadRequestError } from '../../errors/index.js';
import { TenancyRepository } from '../tenancy/repository.js';
import { FamilyFeedbackRepository } from './repository.js';
import type {
  FeedbackStatusResponse,
  SaveFeedbackOptions,
  SubmitFeedbackInput,
  SubmitFeedbackResponse
} from './types.js';

export class FamilyFeedbackService {
  /**
   * Submits structured parent feedback for a household, unlocking performance reports.
   * Enforces non-empty rating, whatsWorking, and whatsToImprove.
   * Triggers a fire-and-forget webhook to append the feedback to Google Sheets via n8n.
   */
  static async saveFeedback(
    db: Queryable,
    householdId: string,
    input: SubmitFeedbackInput,
    options?: SaveFeedbackOptions
  ): Promise<SubmitFeedbackResponse> {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestError('Rating must be an integer between 1 and 5');
    }

    const whatsWorking = input.whatsWorking?.trim();
    if (!whatsWorking) {
      throw new BadRequestError("What's working field cannot be empty");
    }

    const whatsToImprove = input.whatsToImprove?.trim();
    if (!whatsToImprove) {
      throw new BadRequestError("What's to improve field cannot be empty");
    }

    const feedback = await FamilyFeedbackRepository.createFeedback(db, householdId, {
      rating: input.rating,
      whatsWorking,
      whatsToImprove
    });

    // Fire-and-forget webhook post to n8n for Google Sheets integration
    const webhookUrl = options?.webhookUrl || process.env.N8N_FEEDBACK_WEBHOOK_URL;
    if (webhookUrl) {
      Promise.resolve().then(async () => {
        try {
          const children = await TenancyRepository.listChildProfilesByHousehold(db, householdId);
          const child = children[0];
          const payload = {
            householdId,
            childName: child?.preferredName ?? null,
            grade: child?.gradeBand ?? null,
            rating: feedback.rating,
            whatsWorking: feedback.whatsWorking,
            whatsToImprove: feedback.whatsToImprove,
            source: options?.source ?? 'web',
            createdAt: feedback.createdAt.toISOString()
          };

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          }).finally(() => clearTimeout(timeoutId));
        } catch (err: any) {
          console.warn('[FamilyFeedback] Failed to post feedback to n8n webhook:', err?.message || err);
        }
      }).catch(() => {});
    }

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
