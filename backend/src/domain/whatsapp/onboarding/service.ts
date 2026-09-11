import type { Queryable, TransactionalQueryable } from '../../../db/types.js';
import { BadRequestError } from '../../../errors/index.js';
import { normalizePhoneNumber, TenancyRepository } from '../../tenancy/repository.js';
import { ensureBetaSubscription } from '../../subscription/beta-service.js';
import { LearningStyles, ResponseStyles, type LearningStyle, type ResponseStyle, type UpdateChildPersonalisationInput } from '../../personalisation/types.js';
import { PersonalisationRepository } from '../../personalisation/repository.js';
import { type UpdateChildProfileInput } from '../../tenancy/types.js';
import {
  evaluateCompleteness,
  isValidDobString,
  isValidLanguageCode
} from './completeness.js';
import { WhatsAppOnboardingRepository } from './repository.js';
import {
  REQUIRED_ONBOARDING_FIELDS,
  type WhatsAppOnboardingStateResult,
  type WhatsAppPersonalisationState,
  type WhatsAppRequiredField,
  type WhatsAppSaveStepInput,
  type WhatsAppSaveStepResult,
  type WhatsAppSupportedField
} from './types.js';

const safeStringPattern = /^[^<>`$]*$/;

function validateName(val: unknown): string {
  if (typeof val !== 'string') throw new BadRequestError('Name must be a string');
  const trimmed = val.trim();
  if (trimmed.length < 1) throw new BadRequestError('Name cannot be empty');
  if (trimmed.length > 100) throw new BadRequestError('Name cannot exceed 100 characters');
  if (!safeStringPattern.test(trimmed)) throw new BadRequestError('Name contains forbidden characters');
  return trimmed;
}

function validateNickname(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val !== 'string') throw new BadRequestError('Nickname must be a string');
  const trimmed = val.trim();
  if (trimmed.length < 1) return null;
  if (trimmed.length > 50) throw new BadRequestError('Nickname cannot exceed 50 characters');
  if (!safeStringPattern.test(trimmed)) throw new BadRequestError('Nickname contains forbidden characters');
  return trimmed;
}

function validateGrade(val: unknown): string {
  if (typeof val !== 'string') throw new BadRequestError('Grade must be a string');
  const trimmed = val.trim();
  if (trimmed.length < 1) throw new BadRequestError('Grade cannot be empty');
  if (trimmed.length > 50) throw new BadRequestError('Grade cannot exceed 50 characters');
  if (!safeStringPattern.test(trimmed)) throw new BadRequestError('Grade contains forbidden characters');
  return trimmed;
}

function validateDob(val: unknown): string {
  if (typeof val !== 'string') throw new BadRequestError('Date of birth must be a string (YYYY-MM-DD)');
  const trimmed = val.trim();
  if (!isValidDobString(trimmed)) {
    throw new BadRequestError('Date of birth must be YYYY-MM-DD representing an age between 3 and 25 years old');
  }
  return trimmed;
}

function validateLanguage(val: unknown): string {
  if (typeof val !== 'string') throw new BadRequestError('Preferred language must be a string');
  let trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'english' || lower.startsWith('eng')) trimmed = 'en';
  else if (lower === 'hindi' || lower.startsWith('hin')) trimmed = 'hi';
  else if (lower === 'kannada' || lower.startsWith('kan')) trimmed = 'kn';
  if (!isValidLanguageCode(trimmed)) {
    throw new BadRequestError('Invalid language code format (e.g. en, hi, kn)');
  }
  return trimmed;
}

function normalizeStringArray(val: unknown, fieldName: string): string[] {
  let list: string[] = [];
  if (Array.isArray(val)) {
    list = val.map((item) => String(item).trim());
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes(',')) {
      list = trimmed.split(',').map((s) => s.trim());
    } else if (trimmed.length > 0) {
      list = [trimmed];
    }
  } else {
    throw new BadRequestError(`${fieldName} must be an array of strings or a comma-separated string`);
  }

  list = list.filter((s) => s.length > 0);
  if (list.length === 0) {
    throw new BadRequestError(`${fieldName} cannot be empty`);
  }
  if (list.length > 20) {
    throw new BadRequestError(`${fieldName} cannot exceed 20 items`);
  }
  for (const item of list) {
    if (item.length > 60) {
      throw new BadRequestError(`Each item in ${fieldName} must be at most 60 characters`);
    }
    if (!safeStringPattern.test(item)) {
      throw new BadRequestError(`Item in ${fieldName} contains forbidden characters`);
    }
  }
  return list;
}

function validateLearningStyle(val: unknown): LearningStyle {
  if (typeof val !== 'string') {
    throw new BadRequestError(`Invalid learningStyle. Must be one of: ${LearningStyles.join(', ')}`);
  }
  const trimmed = val.trim().toLowerCase();
  if (LearningStyles.includes(trimmed as any)) {
    return trimmed as LearningStyle;
  }
  if (trimmed.includes('visual') || trimmed.includes('video') || trimmed.includes('watch')) return 'visual';
  if (trimmed.includes('audit') || trimmed.includes('listen') || trimmed.includes('hear')) return 'auditory';
  if (trimmed.includes('kinesthe') || trimmed.includes('hand') || trimmed.includes('practic')) return 'kinesthetic';
  if (trimmed.includes('read') || trimmed.includes('writ')) return 'reading_writing';
  if (trimmed.includes('interact') || trimmed.includes('quiz') || trimmed.includes('game')) return 'interactive';
  throw new BadRequestError(`Invalid learningStyle. Must be one of: ${LearningStyles.join(', ')}`);
}

function validateResponseStyle(val: unknown): ResponseStyle {
  if (typeof val !== 'string') {
    throw new BadRequestError(`Invalid responseStyle. Must be one of: ${ResponseStyles.join(', ')}`);
  }
  const trimmed = val.trim().toLowerCase();
  if (ResponseStyles.includes(trimmed as any)) {
    return trimmed as ResponseStyle;
  }
  if (trimmed.includes('play') || trimmed.includes('fun') || trimmed.includes('game') || trimmed.includes('wit')) return 'playful';
  if (trimmed.includes('focus') || trimmed.includes('direct') || trimmed.includes('crisp') || trimmed.includes('strict')) return 'focused';
  if (trimmed.includes('balanc') || trimmed.includes('calm') || trimmed.includes('socrat')) return 'balanced';
  throw new BadRequestError(`Invalid responseStyle. Must be one of: ${ResponseStyles.join(', ')}`);
}

function validateWhatsappConsent(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === 'yes' || lower === '1') return true;
    if (lower === 'false' || lower === 'no' || lower === '0') return false;
  }
  throw new BadRequestError('whatsappConsent must be a boolean');
}

export class WhatsAppOnboardingService {
  /**
   * Resolves the onboarding completeness and current personalization state for a WhatsApp phone number.
   * Read-only and idempotent.
   */
  public static async getState(
    db: Queryable,
    rawPhone: string
  ): Promise<WhatsAppOnboardingStateResult> {
    let normalizedPhone: string | null = null;
    try {
      normalizedPhone = normalizePhoneNumber(rawPhone);
    } catch {
      return {
        recognized: false,
        complete: false,
        missingFields: [...REQUIRED_ONBOARDING_FIELDS],
        nextPromptField: REQUIRED_ONBOARDING_FIELDS[0],
        householdId: null,
        childId: null,
        personalisation: null
      };
    }

    if (!normalizedPhone) {
      return {
        recognized: false,
        complete: false,
        missingFields: [...REQUIRED_ONBOARDING_FIELDS],
        nextPromptField: REQUIRED_ONBOARDING_FIELDS[0],
        householdId: null,
        childId: null,
        personalisation: null
      };
    }

    const household = await WhatsAppOnboardingRepository.findHouseholdByPhone(db, normalizedPhone);
    if (!household) {
      return {
        recognized: false,
        complete: false,
        missingFields: [...REQUIRED_ONBOARDING_FIELDS],
        nextPromptField: REQUIRED_ONBOARDING_FIELDS[0],
        householdId: null,
        childId: null,
        personalisation: null
      };
    }

    const child = await WhatsAppOnboardingRepository.findActiveChild(db, household.id);
    if (!child) {
      return {
        recognized: true,
        complete: false,
        missingFields: [...REQUIRED_ONBOARDING_FIELDS],
        nextPromptField: REQUIRED_ONBOARDING_FIELDS[0],
        householdId: household.id,
        childId: null,
        personalisation: null
      };
    }

    const personalisation = await WhatsAppOnboardingRepository.mergePersonalisation(
      db,
      household.id,
      child.id,
      {}
    );

    const additionalContext = (personalisation.additionalContext ?? {}) as Record<string, unknown>;
    const rawAnswered = additionalContext.onboarding_answered;
    let answeredSet: Set<string>;

    if (Array.isArray(rawAnswered)) {
      answeredSet = new Set(rawAnswered.filter((s): s is string => typeof s === 'string'));
    } else {
      // Legacy or web onboarding fallback: infer from existing profile data
      answeredSet = new Set<string>();
      if (child.preferredName && child.preferredName.trim().length > 0) answeredSet.add('name');
      if (child.gradeBand && child.gradeBand.trim().length > 0) answeredSet.add('grade');
      if (child.dob && isValidDobString(child.dob)) answeredSet.add('dob');
      if (personalisation.preferredLanguage) answeredSet.add('preferredLanguage');
      if (personalisation.favoriteSubjects && personalisation.favoriteSubjects.length > 0) answeredSet.add('favoriteSubjects');
      if (personalisation.interests && personalisation.interests.length > 0) answeredSet.add('interests');
      if (personalisation.goals && personalisation.goals.length > 0) answeredSet.add('goals');
      if (household.whatsappConsent) answeredSet.add('whatsappConsent');
      // For enums, only count as answered if explicit or if multiple fields are set (indicating completed setup)
      if (answeredSet.size >= 4) {
        answeredSet.add('learningStyle');
        answeredSet.add('responseStyle');
      }
    }

    const state: WhatsAppPersonalisationState = {
      name: answeredSet.has('name') && child.preferredName.trim().length > 0 ? child.preferredName : null,
      nickname: child.nickname ?? null,
      grade: answeredSet.has('grade') && child.gradeBand.trim().length > 0 ? child.gradeBand : null,
      dob: child.dob ?? null,
      preferredLanguage: personalisation.preferredLanguage ?? 'en',
      favoriteSubjects: personalisation.favoriteSubjects ?? [],
      interests: personalisation.interests ?? [],
      learningStyle: answeredSet.has('learningStyle') ? personalisation.learningStyle : null,
      responseStyle: answeredSet.has('responseStyle') ? personalisation.responseStyle : null,
      goals: personalisation.goals ?? [],
      whatsappConsent: Boolean(household.whatsappConsent)
    };

    const evaluation = evaluateCompleteness(state, answeredSet);

    return {
      recognized: true,
      complete: evaluation.complete,
      missingFields: evaluation.missingFields,
      nextPromptField: evaluation.nextPromptField,
      householdId: household.id,
      childId: child.id,
      personalisation: state
    };
  }

  /**
   * Incrementally saves one or more onboarding fields for a WhatsApp phone number.
   * Atomically creates household and child if they do not exist.
   */
  public static async saveStep(
    db: TransactionalQueryable,
    input: WhatsAppSaveStepInput,
    options?: { betaChatLimit?: number }
  ): Promise<WhatsAppSaveStepResult> {
    if (!input || typeof input !== 'object') {
      throw new BadRequestError('Invalid request payload');
    }

    const rawPhone = input.phone;
    if (!rawPhone || typeof rawPhone !== 'string') {
      throw new BadRequestError('Phone number is required');
    }

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      throw new BadRequestError('Invalid phone number format');
    }

    // Extract fields to save
    let fieldsToSave: Partial<Record<WhatsAppSupportedField, unknown>> = {};
    if ('field' in input && input.field) {
      fieldsToSave[input.field] = input.value;
    } else if ('fields' in input && input.fields && typeof input.fields === 'object') {
      fieldsToSave = input.fields;
    } else {
      throw new BadRequestError('Either field & value or fields object must be provided');
    }

    const fieldKeys = Object.keys(fieldsToSave) as WhatsAppSupportedField[];
    if (fieldKeys.length === 0) {
      throw new BadRequestError('No valid fields provided to save');
    }

    // Validate inputs before beginning database transaction
    const validatedChildUpdates: UpdateChildProfileInput = {};
    const validatedPersonalisationUpdates: UpdateChildPersonalisationInput = {};
    let validatedConsent: boolean | undefined = undefined;
    const newlyAnsweredFields: string[] = [];

    for (const key of fieldKeys) {
      const val = fieldsToSave[key];
      switch (key) {
        case 'name': {
          const validated = validateName(val);
          validatedChildUpdates.preferredName = validated;
          newlyAnsweredFields.push('name');
          break;
        }
        case 'nickname': {
          const validated = validateNickname(val);
          validatedChildUpdates.nickname = validated;
          newlyAnsweredFields.push('nickname');
          break;
        }
        case 'grade': {
          const validated = validateGrade(val);
          validatedChildUpdates.gradeBand = validated;
          newlyAnsweredFields.push('grade');
          break;
        }
        case 'dob': {
          const validated = validateDob(val);
          validatedChildUpdates.dob = validated;
          newlyAnsweredFields.push('dob');
          break;
        }
        case 'preferredLanguage': {
          const validated = validateLanguage(val);
          validatedPersonalisationUpdates.preferredLanguage = validated;
          newlyAnsweredFields.push('preferredLanguage');
          break;
        }
        case 'favoriteSubjects': {
          const validated = normalizeStringArray(val, 'favoriteSubjects');
          validatedPersonalisationUpdates.favoriteSubjects = validated;
          newlyAnsweredFields.push('favoriteSubjects');
          break;
        }
        case 'interests': {
          const validated = normalizeStringArray(val, 'interests');
          validatedPersonalisationUpdates.interests = validated;
          newlyAnsweredFields.push('interests');
          break;
        }
        case 'learningStyle': {
          const validated = validateLearningStyle(val);
          validatedPersonalisationUpdates.learningStyle = validated;
          newlyAnsweredFields.push('learningStyle');
          break;
        }
        case 'responseStyle': {
          const validated = validateResponseStyle(val);
          validatedPersonalisationUpdates.responseStyle = validated;
          newlyAnsweredFields.push('responseStyle');
          break;
        }
        case 'goals': {
          const validated = normalizeStringArray(val, 'goals');
          validatedPersonalisationUpdates.goals = validated;
          newlyAnsweredFields.push('goals');
          break;
        }
        case 'whatsappConsent': {
          validatedConsent = validateWhatsappConsent(val);
          if (validatedConsent) {
            newlyAnsweredFields.push('whatsappConsent');
          }
          break;
        }
        default:
          throw new BadRequestError(`Unsupported onboarding field: ${key as string}`);
      }
    }

    return db.transaction(async (tx) => {
      // 1. Find or create phone-only household
      let household = await WhatsAppOnboardingRepository.findHouseholdByPhone(tx, normalizedPhone);
      if (!household) {
        household = await WhatsAppOnboardingRepository.createPhoneOnlyHousehold(
          tx,
          normalizedPhone,
          validatedChildUpdates.preferredName ? `${validatedChildUpdates.preferredName}'s Household` : null
        );
      }

      // 2. Find or create active child profile
      let child = await WhatsAppOnboardingRepository.findActiveChild(tx, household.id);
      if (!child) {
        child = await WhatsAppOnboardingRepository.createChildProfile(
          tx,
          household.id,
          validatedChildUpdates.preferredName ?? '',
          validatedChildUpdates.gradeBand ?? ''
        );
      }

      // 3. Update child profile if needed
      if (Object.keys(validatedChildUpdates).length > 0) {
        const updated = await TenancyRepository.updateChildProfile(
          tx,
          household.id,
          child.id,
          validatedChildUpdates
        );
        if (updated) {
          child = updated;
        }

        // Update household name if name changed and household had generic default
        if (validatedChildUpdates.preferredName && (!household.name || household.name === 'Learner Household')) {
          await WhatsAppOnboardingRepository.updateHouseholdName(
            tx,
            household.id,
            `${validatedChildUpdates.preferredName}'s Household`
          );
        }
      }

      // 4. Update WhatsApp consent if provided
      if (validatedConsent !== undefined) {
        await WhatsAppOnboardingRepository.updateWhatsAppConsent(tx, household.id, validatedConsent);
        household.whatsappConsent = validatedConsent;
      }

      // 5. Update personalisation & tracked answered fields
      const existingPers = await PersonalisationRepository.getPersonalisation(tx, household.id, child.id);
      const existingContext = (existingPers?.additionalContext ?? {}) as Record<string, unknown>;
      const existingAnswered = Array.isArray(existingContext.onboarding_answered)
        ? existingContext.onboarding_answered.filter((s): s is string => typeof s === 'string')
        : [];

      const mergedAnswered = Array.from(new Set([...existingAnswered, ...newlyAnsweredFields]));

      validatedPersonalisationUpdates.additionalContext = {
        ...existingContext,
        onboarding_answered: mergedAnswered
      };

      const updatedPers = await WhatsAppOnboardingRepository.mergePersonalisation(
        tx,
        household.id,
        child.id,
        validatedPersonalisationUpdates
      );

      // 6. Ensure beta subscription and plan entitlements
      await ensureBetaSubscription(tx, household.id, options?.betaChatLimit ?? 30);

      // 7. Compute updated state & completeness
      const answeredSet = new Set(mergedAnswered);

      const state: WhatsAppPersonalisationState = {
        name: answeredSet.has('name') && child.preferredName.trim().length > 0 ? child.preferredName : null,
        nickname: child.nickname ?? null,
        grade: answeredSet.has('grade') && child.gradeBand.trim().length > 0 ? child.gradeBand : null,
        dob: child.dob ?? null,
        preferredLanguage: updatedPers.preferredLanguage ?? 'en',
        favoriteSubjects: updatedPers.favoriteSubjects ?? [],
        interests: updatedPers.interests ?? [],
        learningStyle: answeredSet.has('learningStyle') ? updatedPers.learningStyle : null,
        responseStyle: answeredSet.has('responseStyle') ? updatedPers.responseStyle : null,
        goals: updatedPers.goals ?? [],
        whatsappConsent: Boolean(household.whatsappConsent)
      };

      const evaluation = evaluateCompleteness(state, answeredSet);

      return {
        success: true,
        recognized: true,
        complete: evaluation.complete,
        missingFields: evaluation.missingFields,
        nextPromptField: evaluation.nextPromptField,
        householdId: household.id,
        childId: child.id,
        personalisation: state
      };
    });
  }
}
