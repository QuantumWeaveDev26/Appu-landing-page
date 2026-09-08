import type { PromptCategory } from './types.js';

export type GradeTier = '5-7' | '8-10' | '11-12';

export const DEFAULT_SUBJECTS = ['Science', 'Mathematics'];
export const DEFAULT_INTERESTS = ['Space', 'Technology'];

export const CATEGORY_ICONS: Record<PromptCategory, string> = {
  quick_concepts: 'fa-lightbulb',
  homework_hints: 'fa-book-open-reader',
  curious_mind: 'fa-rocket',
  exam_drills: 'fa-medal'
};

export function resolveGradeTier(gradeBand?: string | null): GradeTier {
  if (!gradeBand) return '5-7';
  const match = gradeBand.match(/\d+/);
  if (!match) {
    const lower = gradeBand.toLowerCase();
    if (lower.includes('11') || lower.includes('12')) return '11-12';
    if (lower.includes('8') || lower.includes('9') || lower.includes('10')) return '8-10';
    return '5-7';
  }
  const num = parseInt(match[0], 10);
  if (num >= 11) return '11-12';
  if (num >= 8) return '8-10';
  return '5-7';
}

export const PROMPT_CATALOGUE: Record<GradeTier, Record<PromptCategory, string[]>> = {
  '5-7': {
    quick_concepts: [
      'Explain {subject} with an easy real-world analogy, Appu!',
      'What are the 3 key building blocks of {subject} for {grade}?',
      'How does {interest} connect to basic rules of {subject}?',
      'Help {name} understand {subject} in simple terms with a picture in mind.'
    ],
    homework_hints: [
      'Give me a step-by-step hint for my {subject} homework without revealing the final answer.',
      'How can {name} double-check the steps for this tricky {subject} question?',
      'What is the best way to begin solving this {grade} {subject} problem?',
      "I'm stuck on a {subject} problem! Can you guide {name} with a helpful clue?"
    ],
    curious_mind: [
      'What would happen if {interest} was part of our everyday life?',
      'Why does {interest} work the way it does in nature?',
      'Tell {name} an incredible mystery about {interest} and science!',
      'Could we use {interest} to explore other planets or the deep ocean?'
    ],
    exam_drills: [
      'Quiz {name} with 3 rapid-fire revision questions on {grade} {subject}!',
      'Test my memory on key definitions and rules in {subject}.',
      'Give me a typical exam question for {grade} {subject} with feedback.',
      'Ask me a fun {subject} challenge question to test my readiness, Appu!'
    ]
  },
  '8-10': {
    quick_concepts: [
      'Explain the core scientific principles behind {subject} step-by-step.',
      'Summarize the key formulas, laws, and concepts in {subject} for {grade}.',
      'How is modern {interest} transforming our understanding of {subject}?',
      'Break down the underlying mechanisms of {subject} for {name}.'
    ],
    homework_hints: [
      'Provide an analytical hint for solving multi-step {subject} problem sets.',
      'What systematic approach should I apply to {grade} {subject} numericals?',
      'Help {name} spot the most common calculation traps in {subject}.',
      'Guide me with a conceptual clue to deduce the next step in my {subject} assignment.'
    ],
    curious_mind: [
      'What are the biggest unsolved mysteries at the intersection of {interest} and science?',
      'Could emerging innovations in {interest} revolutionize sustainable energy?',
      'Explore the real science versus popular myths about {interest} with {name}.',
      'How do scientists design experiments to test theories in {interest}?'
    ],
    exam_drills: [
      'Give {name} a timed practice drill of 3 high-yield questions in {grade} {subject}.',
      'Test my conceptual clarity on frequently tested {subject} board topics.',
      'Pose an application-based problem connecting {subject} with {interest}.',
      'Challenge me with a tough {subject} exam question and grade my answer.'
    ]
  },
  '11-12': {
    quick_concepts: [
      'Derive and explain the theoretical foundations of {subject} for {grade}.',
      'Analyze how advanced {interest} leverages higher-level principles in {subject}.',
      'Provide a rigorous conceptual summary of high-yield {subject} topics.',
      'Clarify the subtle mathematical and physical nuances of {subject} for {name}.'
    ],
    homework_hints: [
      'Provide a strategic problem-solving hint for complex {grade} {subject} problems.',
      'Highlight boundary conditions and conservation laws relevant to this {subject} question.',
      'Help {name} diagnose where conceptual errors occur in advanced {subject} derivations.',
      'Guide me through the analytical framework needed for this {subject} assignment.'
    ],
    curious_mind: [
      'Discuss current research breakthroughs and frontier challenges in {interest}.',
      'How do theoretical constraints limit what is physically possible in {interest}?',
      'Analyze the interdisciplinary applications of {interest} in modern technology.',
      'Debate with {name} the emerging ethical and technological dilemmas in {interest}.'
    ],
    exam_drills: [
      'Quiz {name} on competitive entrance exam questions for {grade} {subject}.',
      'Provide an assertion-reason drill testing deep conceptual understanding of {subject}.',
      'Simulate a high-difficulty multi-concept problem in {grade} {subject}.',
      'Test {name} on rapid problem-solving shortcuts and elimination strategies in {subject}.'
    ]
  }
};
