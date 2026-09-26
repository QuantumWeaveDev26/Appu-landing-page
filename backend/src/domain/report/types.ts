export interface ReportSubject {
  subject: string;
  score: number; // 0-100
  note: string;
}

export interface ReportEngagement {
  totalChats: number;
  activeDays: number;
  topSubject: string;
}

export interface ChildPerformanceReport {
  childName: string;
  grade: string;
  period: 'cumulative';
  generatedAt: string; // ISO-8601
  overallScore: number; // 0-100
  scoreLabel: string;
  summary: string; // 2-3 sentences, parent-facing
  subjects: ReportSubject[];
  strengths: string[]; // 3-5
  improvements: string[]; // 3-5 ("what should be improved")
  topicsCovered: string[]; // 0-12 chips
  recommendations: string[]; // 3-5 actionable
  engagement: ReportEngagement;
  // Phase C: off-syllabus topics the child explored, framed positively.
  // Optional/empty by default; the report UI hides the section when empty.
  curiosityBeyondSyllabus?: CuriosityTopic[];
}

export interface CuriosityTopic {
  topic: string;
  expectedGrade: string | null;
  when: string; // ISO-8601
}

export interface LlmReportOutput {
  overallScore: number;
  scoreLabel: string;
  summary: string;
  subjects: ReportSubject[];
  strengths: string[];
  improvements: string[];
  topicsCovered: string[];
  recommendations: string[];
}
