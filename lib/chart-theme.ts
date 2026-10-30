/** Recharts does not reliably resolve `hsl(var(--x))` on SVG nodes — use explicit colors per theme. */

export type ChartColorMode = 'light' | 'dark';

export function getRechartsTheme(mode: ChartColorMode) {
  const isDark = mode === 'dark';
  return {
    gridStroke: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(24, 24, 27, 0.10)',
    tickFill: isDark ? '#d4d4d8' : '#52525b',
    axisLine: isDark ? '#3f3f46' : '#d4d4d8',
    tooltipBg: isDark ? '#18181b' : '#ffffff',
    tooltipBorder: isDark ? '#3f3f46' : '#e4e4e7',
    tooltipFg: isDark ? '#fafafa' : '#18181b',
    tooltipMuted: isDark ? '#a1a1aa' : '#71717a',
    cursorFill: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
  };
}

const BAR_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#db2777',
] as const;

/** Use DB skill color when it looks like hex; otherwise cycle a readable palette. */
export function getSkillBarFill(skillColor: string | null | undefined, index: number): string {
  const c = skillColor?.trim();
  if (c && /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) {
    return c;
  }
  return BAR_PALETTE[index % BAR_PALETTE.length];
}
