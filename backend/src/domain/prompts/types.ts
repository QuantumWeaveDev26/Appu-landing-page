export type PromptCategory =
  | 'quick_concepts'
  | 'homework_hints'
  | 'curious_mind'
  | 'exam_drills';

export interface ChildPrompt {
  id: string;
  householdId: string;
  childId: string;
  category: PromptCategory;
  promptText: string;
  icon: string;
  createdAt: Date;
}

export interface CreatePromptInput {
  category: PromptCategory;
  promptText: string;
  icon?: string;
}
