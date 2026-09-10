/**
 * APPU design tokens — ported from the website's dark-cyan brand (frontend/style.css).
 * Kept framework-agnostic so screens and future components share one source of truth.
 */
export const theme = {
  colors: {
    bg: '#06101f',          // deep app background
    bgElevated: '#071426',  // hero / stage background
    surface: 'rgba(8, 30, 54, 0.7)',
    line: 'rgba(105, 216, 239, 0.18)',
    cyan: '#22d3ee',        // --cyan-bright accent
    cyanSoft: '#7cecff',    // eyebrow / soft accent
    amber: '#f5b301',
    text: '#ffffff',
    textMuted: '#b6c4d9',
  },
  radius: { sm: 10, md: 14, lg: 20, pill: 999 },
  space: (n: number) => n * 4,
} as const;

export type Theme = typeof theme;
