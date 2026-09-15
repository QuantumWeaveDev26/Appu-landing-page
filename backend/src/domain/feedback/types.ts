export interface FamilyFeedback {
  id: string;
  householdId: string;
  rating: number; // 1-5
  whatsWorking: string | null;
  whatsToImprove: string | null;
  createdAt: Date;
}

export interface SubmitFeedbackInput {
  rating: number;
  whatsWorking?: string | null;
  whatsToImprove?: string | null;
}

export interface FeedbackStatusResponse {
  submitted: boolean;
  reportsUnlocked: boolean;
  feedback: {
    id: string;
    rating: number;
    whatsWorking: string | null;
    whatsToImprove: string | null;
    createdAt: string;
  } | null;
}

export interface SubmitFeedbackResponse {
  reportsUnlocked: boolean;
  feedback: {
    id: string;
    householdId: string;
    rating: number;
    whatsWorking: string | null;
    whatsToImprove: string | null;
    createdAt: string;
  };
}
