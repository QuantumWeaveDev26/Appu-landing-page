import {
  REQUIRED_ONBOARDING_FIELDS,
  type WhatsAppPersonalisationState,
  type WhatsAppRequiredField
} from './types.js';
import { LearningStyles, ResponseStyles } from '../../personalisation/types.js';

export function isValidDobString(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const parts = trimmed.split('-').map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }

  const now = new Date();
  if (parsed > now) return false;
  const ageYears = (now.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return ageYears >= 3 && ageYears <= 25;
}

export function isValidLanguageCode(code: string | null | undefined): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[a-z]{2}(-[A-Z]{2})?$/.test(code.trim());
}

export interface CompletenessEvaluation {
  complete: boolean;
  missingFields: WhatsAppRequiredField[];
  nextPromptField: WhatsAppRequiredField | null;
}

export function evaluateCompleteness(
  state: WhatsAppPersonalisationState | null,
  answeredSet?: Set<string>
): CompletenessEvaluation {
  if (!state) {
    return {
      complete: false,
      missingFields: [...REQUIRED_ONBOARDING_FIELDS],
      nextPromptField: REQUIRED_ONBOARDING_FIELDS[0]
    };
  }

  const missingFields: WhatsAppRequiredField[] = [];

  for (const field of REQUIRED_ONBOARDING_FIELDS) {
    switch (field) {
      case 'name':
        if ((answeredSet && !answeredSet.has('name')) || !state.name || state.name.trim().length === 0) {
          missingFields.push('name');
        }
        break;
      case 'grade':
        if ((answeredSet && !answeredSet.has('grade')) || !state.grade || state.grade.trim().length === 0) {
          missingFields.push('grade');
        }
        break;
      case 'dob':
        if ((answeredSet && !answeredSet.has('dob')) || !isValidDobString(state.dob)) {
          missingFields.push('dob');
        }
        break;
      case 'preferredLanguage':
        if ((answeredSet && !answeredSet.has('preferredLanguage')) || !isValidLanguageCode(state.preferredLanguage)) {
          missingFields.push('preferredLanguage');
        }
        break;
      case 'favoriteSubjects':
        if ((answeredSet && !answeredSet.has('favoriteSubjects')) || !Array.isArray(state.favoriteSubjects) || state.favoriteSubjects.length === 0) {
          missingFields.push('favoriteSubjects');
        }
        break;
      case 'interests':
        if ((answeredSet && !answeredSet.has('interests')) || !Array.isArray(state.interests) || state.interests.length === 0) {
          missingFields.push('interests');
        }
        break;
      case 'learningStyle':
        if (
          (answeredSet && !answeredSet.has('learningStyle')) ||
          !state.learningStyle ||
          !LearningStyles.includes(state.learningStyle as any)
        ) {
          missingFields.push('learningStyle');
        }
        break;
      case 'responseStyle':
        if (
          (answeredSet && !answeredSet.has('responseStyle')) ||
          !state.responseStyle ||
          !ResponseStyles.includes(state.responseStyle as any)
        ) {
          missingFields.push('responseStyle');
        }
        break;
      case 'goals':
        if ((answeredSet && !answeredSet.has('goals')) || !Array.isArray(state.goals) || state.goals.length === 0) {
          missingFields.push('goals');
        }
        break;
      case 'whatsappConsent':
        if (state.whatsappConsent !== true) {
          missingFields.push('whatsappConsent');
        }
        break;
    }
  }

  const complete = missingFields.length === 0;
  const nextPromptField = missingFields.length > 0 ? missingFields[0] : null;

  return {
    complete,
    missingFields,
    nextPromptField
  };
}
