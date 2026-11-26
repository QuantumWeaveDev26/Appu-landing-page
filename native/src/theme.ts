/**
 * APPU design tokens — the website's chat-first look (DESIGN.md): plain navy page (light:
 * #f8fafc), cyan accent, Manrope body and Space Grotesk headings.
 *
 * The theme is chosen once at start-up (App.tsx calls applyTheme before any screen loads), so
 * every StyleSheet picks up the right colours. Colours written directly in a screen go through
 * `tc()`, which keeps them in dark mode and converts them to a matching light colour.
 */
export type ThemeMode = 'dark' | 'light';

const DARK = {
  bg: '#0b1322',
  bgElevated: '#0f1a2e',
  surface: '#111d33',
  line: 'rgba(148, 197, 255, 0.16)',
  cyan: '#0ea5e9',
  cyanSoft: '#38bdf8',
  amber: '#f5b301',
  text: '#f1f5f9',
  textMuted: '#94a3b8',
  userBubble: '#12325a',
  success: '#4ade80',
  danger: '#f87171',
};

const LIGHT: typeof DARK = {
  bg: '#f8fafc',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  line: 'rgba(15, 23, 42, 0.12)',
  cyan: '#0ea5e9',
  cyanSoft: '#0369a1',
  amber: '#b45309',
  text: '#0f172a',
  textMuted: '#475569',
  userBubble: '#dbeafe',
  success: '#15803d',
  danger: '#dc2626',
};

export const theme = {
  mode: 'dark' as ThemeMode,
  colors: { ...DARK },
  fonts: {
    body: 'Manrope_500Medium',
    bodyBold: 'Manrope_700Bold',
    heading: 'SpaceGrotesk_700Bold',
  },
  radius: { sm: 10, md: 14, lg: 20, xl: 24, pill: 999, full: 999 },
  space: (n: number) => n * 4,
};

export type Theme = typeof theme;

export function applyTheme(mode: ThemeMode) {
  theme.mode = mode;
  Object.assign(theme.colors, mode === 'light' ? LIGHT : DARK);
}

/* ---------- colour conversion for light mode ---------- */

type RGBA = { r: number; g: number; b: number; a: number };

function parse(color: string): RGBA | null {
  const c = color.trim().toLowerCase();
  if (c === 'white') return { r: 255, g: 255, b: 255, a: 1 };
  if (c === 'black') return { r: 0, g: 0, b: 0, a: 1 };
  let m = c.match(/^#([0-9a-f]{3})$/);
  if (m) {
    const [r, g, b] = m[1].split('').map((h) => parseInt(h + h, 16));
    return { r, g, b, a: 1 };
  }
  m = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = c.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((s) => s.trim());
    return { r: +r, g: +g, b: +b, a: +a };
  }
  return null;
}

function toHsl({ r, g, b }: RGBA) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl(h: number, s: number, l: number, a: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const [r, g, b] = [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Light-mode counterpart of a dark-mode colour. kind 't' = text/icon colour, 'b' = fill/border. */
export function toLight(color: string, kind: 't' | 'b' = 'b'): string {
  const c = parse(color);
  if (!c) return color;
  const { h, s, l } = toHsl(c);
  const whiteish = c.r > 230 && c.g > 230 && c.b > 230;

  // Faint white overlays on navy become faint navy overlays on white.
  if (whiteish && c.a < 1) return `rgba(15, 23, 42, ${Math.min(0.12, c.a * 1.5).toFixed(3)})`;
  // Dark scrims behind sheets stay dark.
  if (c.a < 1 && l < 0.15) return color;
  // Translucent accent tints read fine on white.
  if (c.a < 1) return color;

  if (kind === 't') {
    if (l < 0.2) return color; // dark text on bright buttons
    if (s < 0.25) return fromHsl(h, s, Math.max(0.12, 1 - l - 0.08), 1); // greys: flip lightness
    return fromHsl(h, Math.min(1, s), Math.min(l, 0.36), 1); // bright accent text: darken
  }
  // Fills / borders: navy surfaces become light surfaces, accents stay.
  if (l < 0.32) return fromHsl(h, Math.min(s, 0.6), 0.97 - l * 0.35, 1);
  if (whiteish) return '#0f172a';
  return color;
}

/** Use for any colour written directly in a screen. */
export function tc(color: string, kind: 't' | 'b' = 'b'): string {
  return theme.mode === 'light' ? toLight(color, kind) : color;
}
