import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Circle,
  renderToBuffer
} from '@react-pdf/renderer';
import type { ChildPerformanceReport } from './types.js';

const h = React.createElement;

// Validated palette tokens from docs/parent-report-design.md
const colors = {
  headerBg: '#06101f',
  brandCyan: '#0EA5C4',
  pageBg: '#f9f9f7',
  cardBg: '#fcfcfb',
  hairlineBorder: '#e6e5e0',
  gridline: '#e1e0d9',
  inkPrimary: '#0b0b0b',
  inkSecondary: '#52514e',
  inkMuted: '#898781',
  scoreDial: '#2a78d6',
  goodGreen: '#0ca30c',
  warningAmber: '#fab219',
  criticalRed: '#d03b3b'
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.pageBg,
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: colors.inkPrimary,
    paddingBottom: 40
  },
  headerBand: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: 28,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    color: colors.brandCyan,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
    letterSpacing: 1
  },
  headerMeta: {
    alignItems: 'flex-end'
  },
  headerChildName: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'Helvetica-Bold'
  },
  headerMetaSub: {
    color: '#cbd5e1',
    fontSize: 8.5,
    marginTop: 2
  },
  cyanRule: {
    height: 2.5,
    backgroundColor: colors.brandCyan
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 16
  },
  heroRow: {
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairlineBorder,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  scoreContainer: {
    width: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16
  },
  scoreLabelText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.inkSecondary,
    marginTop: 4,
    textAlign: 'center'
  },
  summaryContainer: {
    flex: 1
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.inkPrimary,
    marginBottom: 6
  },
  summaryText: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: colors.inkSecondary
  },
  engagementStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairlineBorder,
    padding: 10,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.inkPrimary,
    marginBottom: 2
  },
  statLabel: {
    fontSize: 8,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairlineBorder,
    padding: 12,
    marginBottom: 12
  },
  subjectRow: {
    marginBottom: 8
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3
  },
  subjectName: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.inkPrimary
  },
  subjectScore: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold'
  },
  barTrack: {
    height: 9,
    backgroundColor: colors.gridline,
    borderRadius: 4.5,
    overflow: 'hidden',
    marginBottom: 3
  },
  barFill: {
    height: '100%',
    borderRadius: 4.5
  },
  subjectNote: {
    fontSize: 8.5,
    color: colors.inkSecondary,
    fontFamily: 'Helvetica-Oblique'
  },
  twoColumn: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  columnCard: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairlineBorder,
    padding: 12
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start'
  },
  bulletMarkerGreen: {
    width: 14,
    color: colors.goodGreen,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10
  },
  bulletMarkerAmber: {
    width: 14,
    color: colors.warningAmber,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10
  },
  bulletText: {
    flex: 1,
    fontSize: 8.5,
    lineHeight: 1.35,
    color: colors.inkPrimary
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5
  },
  chip: {
    backgroundColor: colors.cardBg,
    borderColor: colors.hairlineBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  chipText: {
    fontSize: 8,
    color: colors.inkSecondary
  },
  recommendationItem: {
    flexDirection: 'row',
    marginBottom: 5,
    alignItems: 'flex-start'
  },
  recommendationNumber: {
    width: 16,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: colors.brandCyan
  },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: colors.gridline,
    paddingTop: 8
  },
  footerText: {
    fontSize: 7.5,
    color: colors.inkMuted
  }
});

function getScoreColor(score: number): string {
  if (score >= 70) return colors.goodGreen;
  if (score >= 40) return colors.warningAmber;
  return colors.criticalRed;
}

function formatDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return isoDate;
  }
}

export function createReportElement(report: ChildPerformanceReport): React.ReactElement {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.min(100, Math.max(0, report.overallScore));
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;
  const formattedDate = formatDate(report.generatedAt);

  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page },
      // 1. Header Band
      h(
        View,
        { style: styles.headerBand },
        h(
          View,
          null,
          h(Text, { style: styles.headerTitle }, 'Learning Progress Report'),
          h(Text, { style: styles.headerSubtitle }, 'IGR ACADEMY • APPU AI TUTOR')
        ),
        h(
          View,
          { style: styles.headerMeta },
          h(Text, { style: styles.headerChildName }, report.childName),
          h(
            Text,
            { style: styles.headerMetaSub },
            `Grade ${report.grade} • ${formattedDate}`
          )
        )
      ),
      h(View, { style: styles.cyanRule }),

      h(
        View,
        { style: styles.content },
        // 2. Hero Row
        h(
          View,
          { style: styles.heroRow },
          h(
            View,
            { style: styles.scoreContainer },
            h(
              Svg,
              { width: 80, height: 80 },
              h(Circle, {
                cx: 40,
                cy: 40,
                r: radius,
                stroke: colors.gridline,
                strokeWidth: 8,
                fill: 'none'
              }),
              h(Circle, {
                cx: 40,
                cy: 40,
                r: radius,
                stroke: colors.scoreDial,
                strokeWidth: 8,
                fill: 'none',
                strokeDasharray: `${circumference}`,
                strokeDashoffset
              } as any)
            ),
            h(
              View,
              {
                style: {
                  position: 'absolute',
                  top: 22,
                  alignItems: 'center',
                  width: 80
                }
              },
              h(
                Text,
                {
                  style: {
                    fontSize: 18,
                    fontFamily: 'Helvetica-Bold',
                    color: colors.inkPrimary
                  }
                },
                clampedScore
              ),
              h(Text, { style: { fontSize: 7, color: colors.inkMuted } }, '/100')
            ),
            h(Text, { style: styles.scoreLabelText }, report.scoreLabel)
          ),
          h(
            View,
            { style: styles.summaryContainer },
            h(Text, { style: styles.sectionHeading }, 'Executive Summary'),
            h(Text, { style: styles.summaryText }, report.summary)
          )
        ),

        // 3. Engagement Strip
        h(
          View,
          { style: styles.engagementStrip },
          h(
            View,
            { style: styles.statTile },
            h(Text, { style: styles.statValue }, String(report.engagement.totalChats)),
            h(Text, { style: styles.statLabel }, 'Total Chats')
          ),
          h(
            View,
            { style: styles.statTile },
            h(Text, { style: styles.statValue }, String(report.engagement.activeDays)),
            h(Text, { style: styles.statLabel }, 'Active Days')
          ),
          h(
            View,
            { style: styles.statTile },
            h(Text, { style: styles.statValue }, String(report.engagement.topSubject)),
            h(Text, { style: styles.statLabel }, 'Top Subject')
          )
        ),

        // 4. Subjects
        h(
          View,
          { style: styles.sectionCard },
          h(Text, { style: styles.sectionHeading }, 'Subject-by-subject'),
          report.subjects.length === 0
            ? h(
                Text,
                {
                  style: {
                    color: colors.inkMuted,
                    fontStyle: 'italic',
                    fontSize: 9
                  }
                },
                'Not enough subject activity yet.'
              )
            : report.subjects.map((sub, idx) => {
                const barColor = getScoreColor(sub.score);
                return h(
                  View,
                  { key: idx, style: styles.subjectRow },
                  h(
                    View,
                    { style: styles.subjectHeader },
                    h(Text, { style: styles.subjectName }, sub.subject),
                    h(
                      Text,
                      { style: [styles.subjectScore, { color: barColor }] },
                      `${sub.score}/100`
                    )
                  ),
                  h(
                    View,
                    { style: styles.barTrack },
                    h(View, {
                      style: [
                        styles.barFill,
                        {
                          width: `${Math.min(100, Math.max(0, sub.score))}%`,
                          backgroundColor: barColor
                        }
                      ]
                    })
                  ),
                  sub.note
                    ? h(Text, { style: styles.subjectNote }, sub.note)
                    : null
                );
              })
        ),

        // 5. Two-column: Strengths & Improvements
        h(
          View,
          { style: styles.twoColumn },
          h(
            View,
            { style: styles.columnCard },
            h(
              Text,
              { style: [styles.sectionHeading, { color: colors.goodGreen }] },
              'Demonstrated Strengths'
            ),
            report.strengths.map((str, idx) =>
              h(
                View,
                { key: idx, style: styles.bulletRow },
                h(Text, { style: styles.bulletMarkerGreen }, '✓'),
                h(Text, { style: styles.bulletText }, str)
              )
            )
          ),
          h(
            View,
            { style: styles.columnCard },
            h(
              Text,
              { style: [styles.sectionHeading, { color: colors.warningAmber }] },
              'Areas to Improve'
            ),
            report.improvements.map((imp, idx) =>
              h(
                View,
                { key: idx, style: styles.bulletRow },
                h(Text, { style: styles.bulletMarkerAmber }, '•'),
                h(Text, { style: styles.bulletText }, imp)
              )
            )
          )
        ),

        // 6. Topics covered
        report.topicsCovered.length > 0
          ? h(
              View,
              { style: styles.sectionCard },
              h(Text, { style: styles.sectionHeading }, 'Topics Explored'),
              h(
                View,
                { style: styles.chipsContainer },
                report.topicsCovered.map((topic, idx) =>
                  h(
                    View,
                    { key: idx, style: styles.chip },
                    h(Text, { style: styles.chipText }, topic)
                  )
                )
              )
            )
          : null,

        // 7. Recommendations
        h(
          View,
          { style: styles.sectionCard },
          h(Text, { style: styles.sectionHeading }, 'Actionable Recommendations'),
          report.recommendations.map((rec, idx) =>
            h(
              View,
              { key: idx, style: styles.recommendationItem },
              h(Text, { style: styles.recommendationNumber }, `${idx + 1}.`),
              h(Text, { style: styles.bulletText }, rec)
            )
          )
        )
      ),

      // 8. Footer
      h(
        View,
        { style: styles.footer },
        h(
          Text,
          { style: styles.footerText },
          `Generated by Appu • IGR Academy • ${formattedDate}. Based on your child's conversations with Appu.`
        ),
        h(Text, { style: styles.footerText }, 'Page 1 of 1')
      )
    )
  );
}

/**
 * Renders the child performance report into a static print-ready A4 PDF buffer.
 */
export async function renderReportPdf(report: ChildPerformanceReport): Promise<Buffer> {
  const doc = createReportElement(report);
  return renderToBuffer(doc as any);
}

