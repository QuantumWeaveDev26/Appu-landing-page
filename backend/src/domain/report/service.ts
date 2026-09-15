import type { Queryable } from '../../db/types.js';
import {
  FeedbackRequiredError,
  ForbiddenError,
  NotFoundError
} from '../../errors/index.js';
import { TenancyRepository } from '../tenancy/repository.js';
import { PersonalisationRepository } from '../personalisation/repository.js';
import { EntitlementEnforcementService } from '../entitlements/enforcement-service.js';
import { FamilyFeedbackService } from '../feedback/service.js';
import { ReportAggregator } from './aggregator.js';
import { ReportLlmClient } from './llm.js';
import { renderReportPdf } from './pdf-renderer.js';
import type { ChildPerformanceReport } from './types.js';

export interface GenerateReportOptions {
  apiKey?: string;
}

export class ReportService {
  /**
   * Generates a cumulative child performance report.
   * Enforces:
   * 1. Parent feedback gating (feedback required before unlock)
   * 2. Household child ownership
   * 3. Entitlement check (parent_reports)
   * 4. SQL-grounded engagement metrics
   * 5. Fresh LLM analysis with untrusted transcript guard (or friendly placeholder if 0 messages)
   */
  static async generateReport(
    db: Queryable,
    householdId: string,
    childId: string,
    options?: GenerateReportOptions
  ): Promise<ChildPerformanceReport> {
    // 1. GATE: Must have family feedback submitted
    const hasFeedback = await FamilyFeedbackService.hasFamilyFeedback(db, householdId);
    if (!hasFeedback) {
      throw new FeedbackRequiredError();
    }

    // 2. Child profile verification
    const child = await TenancyRepository.getChildProfile(db, householdId, childId);
    if (!child) {
      throw new NotFoundError('Child profile not found in this household');
    }

    // 3. Subscription entitlement check
    const subContext = await EntitlementEnforcementService.getHouseholdEntitlements(db, householdId);
    if (subContext.hasActiveSubscription && subContext.entitlements) {
      if (subContext.entitlements['parent_reports'] === false) {
        throw new ForbiddenError('Your subscription plan does not include child performance reports.');
      }
    }

    // 4. Personalisation
    const personalisation = await PersonalisationRepository.getPersonalisation(db, householdId, childId);
    const favoriteSubjects = personalisation?.favoriteSubjects || [];
    const goals = personalisation?.goals || [];
    const learningStyle = personalisation?.learningStyle || 'Interactive exploration';

    // 5. Engagement stats aggregation
    const engagement = await ReportAggregator.computeEngagement(
      db,
      householdId,
      childId,
      favoriteSubjects
    );

    // 6. Chronological conversation messages (up to 200)
    const messagesRes = await db.query<{ role: string; text: string; created_at: Date }>(
      `SELECT m.role, m.text, m.created_at
       FROM conversation_messages m
       JOIN conversation_sessions s ON s.id = m.conversation_id
       WHERE s.child_id = $1 AND s.household_id = $2
       ORDER BY m.created_at ASC, m.id ASC
       LIMIT 200`,
      [childId, householdId]
    );

    const messages = messagesRes.rows.map((r) => ({
      role: r.role,
      text: r.text
    }));

    const effectiveName = child.nickname || child.preferredName;

    // 7. LLM analysis (with offline fallback and untrusted transcript guard)
    const llmOutput = await ReportLlmClient.generateReportAnalysis({
      childName: effectiveName,
      grade: child.gradeBand,
      favoriteSubjects,
      goals,
      learningStyle,
      totalChats: engagement.totalChats,
      activeDays: engagement.activeDays,
      messages,
      apiKey: options?.apiKey
    });

    const report: ChildPerformanceReport = {
      childName: effectiveName,
      grade: child.gradeBand,
      period: 'cumulative',
      generatedAt: new Date().toISOString(),
      overallScore: llmOutput.overallScore,
      scoreLabel: llmOutput.scoreLabel,
      summary: llmOutput.summary,
      subjects: llmOutput.subjects,
      strengths: llmOutput.strengths,
      improvements: llmOutput.improvements,
      topicsCovered: llmOutput.topicsCovered,
      recommendations: llmOutput.recommendations,
      engagement
    };

    return report;
  }

  /**
   * Generates a cumulative performance report and renders it as an A4 PDF buffer.
   */
  static async generateReportPdf(
    db: Queryable,
    householdId: string,
    childId: string,
    options?: GenerateReportOptions
  ): Promise<{
    report: ChildPerformanceReport;
    pdfBuffer: Buffer;
    filename: string;
  }> {
    const report = await this.generateReport(db, householdId, childId, options);
    const pdfBuffer = await renderReportPdf(report);

    const safeName = report.childName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `appu-progress-report-${safeName}-${dateStr}.pdf`;

    return {
      report,
      pdfBuffer,
      filename
    };
  }
}
