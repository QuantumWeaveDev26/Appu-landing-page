import type { Queryable, TransactionalQueryable } from '../../db/types.js';
import { TenancyRepository } from '../tenancy/repository.js';
import type { ChildProfile } from '../tenancy/types.js';
import { PersonalisationRepository } from '../personalisation/repository.js';
import type { ChildPersonalisation } from '../personalisation/types.js';
import { PromptsRepository } from './repository.js';
import type { ChildPrompt, CreatePromptInput, PromptCategory } from './types.js';
import {
  CATEGORY_ICONS,
  DEFAULT_INTERESTS,
  DEFAULT_SUBJECTS,
  PROMPT_CATALOGUE,
  resolveGradeTier
} from './prompt-catalogue.js';

export class PromptService {
  /**
   * Deterministically generates personalized prompts based on child profile and personalisation settings.
   */
  static generatePrompts(
    child: Pick<ChildProfile, 'preferredName' | 'gradeBand'> & { nickname?: string | null },
    personalisation: Pick<ChildPersonalisation, 'favoriteSubjects' | 'interests'> | null
  ): CreatePromptInput[] {
    const tier = resolveGradeTier(child.gradeBand);
    const categoryTemplates = PROMPT_CATALOGUE[tier];

    const effectiveName = (child.nickname && child.nickname.trim().length > 0)
      ? child.nickname.trim()
      : (child.preferredName || 'Learner');

    const grade = child.gradeBand || 'Grade 6';

    const subjects = (personalisation?.favoriteSubjects && personalisation.favoriteSubjects.length > 0)
      ? personalisation.favoriteSubjects
      : DEFAULT_SUBJECTS;

    const interests = (personalisation?.interests && personalisation.interests.length > 0)
      ? personalisation.interests
      : DEFAULT_INTERESTS;

    const categories: PromptCategory[] = [
      'quick_concepts',
      'homework_hints',
      'curious_mind',
      'exam_drills'
    ];

    const results: CreatePromptInput[] = [];

    for (const category of categories) {
      const templates = categoryTemplates[category] || [];
      const icon = CATEGORY_ICONS[category] || 'fa-lightbulb';

      for (let i = 0; i < templates.length; i++) {
        const tpl = templates[i];
        const subject = subjects[i % subjects.length];
        const interest = interests[i % interests.length];

        const promptText = tpl
          .replaceAll('{subject}', subject)
          .replaceAll('{interest}', interest)
          .replaceAll('{grade}', grade)
          .replaceAll('{name}', effectiveName);

        results.push({
          category,
          promptText,
          icon
        });
      }
    }

    return results;
  }

  /**
   * Returns existing stored prompts for a child, or lazily generates and persists them if empty.
   */
  static async getOrGeneratePrompts(
    db: Queryable,
    householdId: string,
    childId: string
  ): Promise<ChildPrompt[]> {
    const existing = await PromptsRepository.getPromptsByChild(db, householdId, childId);
    if (existing && existing.length > 0) {
      return existing;
    }

    const child = await TenancyRepository.getChildProfile(db, householdId, childId);
    if (!child) {
      throw new Error(`Child profile not found for household ${householdId} and child ${childId}`);
    }

    const personalisation = await PersonalisationRepository.getPersonalisation(db, householdId, childId);

    const generated = PromptService.generatePrompts(child, personalisation);
    return await PromptsRepository.savePrompts(db, householdId, childId, generated);
  }

  /**
   * Replaces existing prompts with a freshly generated set.
   */
  static async regeneratePrompts(
    db: TransactionalQueryable | Queryable,
    householdId: string,
    childId: string
  ): Promise<ChildPrompt[]> {
    const child = await TenancyRepository.getChildProfile(db, householdId, childId);
    if (!child) {
      throw new Error(`Child profile not found for household ${householdId} and child ${childId}`);
    }

    const personalisation = await PersonalisationRepository.getPersonalisation(db, householdId, childId);

    const generated = PromptService.generatePrompts(child, personalisation);
    return await PromptsRepository.replacePrompts(db, householdId, childId, generated);
  }
}
