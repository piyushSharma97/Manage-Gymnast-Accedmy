'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Download,
  Share2,
  MessageSquare,
  Dumbbell,
  Activity,
  Sparkles,
  Heart,
} from 'lucide-react';
import { parseAchievedNumeric } from '@/lib/fitness-result-numeric';
import { cn } from '@/lib/utils';

export type FitnessAssessmentResult = {
  id: number;
  studentId: number;
  fitnessSkillId: number;
  skillName: string;
  /** Category name (same as `level` for backward compatibility) */
  category?: string;
  level: string;
  score: number;
  achievedValue: string | null;
  remark: string | null;
  eventDate: string;
  /** Unit from fitness_skill (e.g. reps, seconds) */
  unitOfMeasurement?: string | null;
  /** Aggregated from fitness_grading_criteria (targets / workout levels) */
  targetValue?: string | null;
};

export type FitnessAssessmentComment = {
  id: number;
  eventid: number;
  tenantId: number;
  studentId: number;
  commentdate: string;
  comment: string | null;
};

type FitnessAssessmentResultsProps = {
  open: boolean;
  onClose: () => void;
  studentName: string;
  results: FitnessAssessmentResult[] | null;
  comments?: FitnessAssessmentComment[] | null;
  isLoading: boolean;
  studentHeight?: number | null;
  studentWeight?: number | null;
  eventName?: string | null;
};

type ResultContentProps = Omit<FitnessAssessmentResultsProps, 'open' | 'onClose'> & {
  /** `full` = page header + actions; `compact` = dialog / embedded */
  variant?: 'full' | 'compact';
};

function categoryKey(r: FitnessAssessmentResult): string {
  return (r.category ?? r.level) || 'Other';
}

/** Prefer last numeric value in strings like "B: 10 reps" */
function parseFirstNumericFromText(s: string | null | undefined): number | null {
  if (s == null || !String(s).trim()) return null;
  const m = String(s).match(/-?\d+(?:\.\d+)?/g);
  if (!m?.length) return null;
  const nums = m.map((x) => parseFloat(x)).filter((n) => Number.isFinite(n));
  if (!nums.length) return null;
  return nums[nums.length - 1];
}

function splitTargetLabel(targetValue: string | null | undefined): {
  badge: string | null;
  rest: string;
} {
  if (!targetValue?.trim()) return { badge: null, rest: '—' };
  const t = targetValue.trim();
  const colon = t.indexOf(':');
  if (colon > 0 && colon < 8) {
    const left = t.slice(0, colon).trim();
    const right = t.slice(colon + 1).trim();
    if (left.length <= 4 && right.length > 0) {
      return { badge: left.slice(0, 3), rest: right };
    }
  }
  return { badge: null, rest: t };
}

function percentToLetter(p: number): string {
  if (p >= 90) return 'A';
  if (p >= 80) return 'B';
  if (p >= 70) return 'C';
  if (p >= 60) return 'D';
  return 'F';
}

function gradeSubtext(p: number): string {
  if (p >= 100) return 'Target met';
  if (p >= 80) return 'Target met mostly';
  if (p >= 60) return 'Target met partially';
  return 'Below target';
}

const CATEGORY_ACCENTS = [
  {
    dot: 'bg-emerald-600',
    bar: 'bg-emerald-600',
    value: 'text-emerald-700 dark:text-emerald-400',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
  },
  {
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    value: 'text-orange-700 dark:text-orange-400',
    badge: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/60 dark:text-orange-200',
  },
  {
    dot: 'bg-amber-500',
    bar: 'bg-amber-500',
    value: 'text-amber-800 dark:text-amber-400',
    badge: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  },
  {
    dot: 'bg-rose-500',
    bar: 'bg-rose-500',
    value: 'text-rose-700 dark:text-rose-400',
    badge: 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
  },
] as const;

/** Mobile: alternate orange / teal category rails (reference: Strength vs Flexibility). */
const MOBILE_CAT_BORDER = [
  'max-md:border-l-[#FF7A00]',
  'max-md:border-l-[#00BFA5]',
] as const;

const MOBILE_CAT_ICON_WRAP = [
  'max-md:bg-[#FF7A00]/20 max-md:text-[#FF7A00]',
  'max-md:bg-[#00BFA5]/20 max-md:text-[#00BFA5]',
] as const;

const MOBILE_CAT_TITLE = [
  'max-md:text-[#FF7A00]',
  'max-md:text-[#00BFA5]',
] as const;

const MOBILE_SCORE_NUM = [
  'max-md:text-[#FF7A00]',
  'max-md:text-[#00BFA5]',
] as const;

const CATEGORY_ICONS = [Dumbbell, Activity, Sparkles, Heart] as const;

function initialsFromName(name: string): string {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function rowProgress(result: FitnessAssessmentResult): {
  pct: number | null;
  targetNum: number | null;
  achievedNum: number;
} {
  const targetNum = parseFirstNumericFromText(result.targetValue);
  const achievedNum = parseAchievedNumeric(result.achievedValue);
  if (targetNum != null && targetNum > 0) {
    return {
      pct: Math.min(100, Math.round((achievedNum / targetNum) * 100)),
      targetNum,
      achievedNum,
    };
  }
  return { pct: null, targetNum, achievedNum };
}

function aggregateCategory(skills: FitnessAssessmentResult[]): {
  sumAchieved: number;
  sumTarget: number;
  avgPct: number | null;
  withTarget: number;
} {
  let sumAchieved = 0;
  let sumTarget = 0;
  const pcts: number[] = [];
  let withTarget = 0;
  for (const r of skills) {
    const { pct, targetNum, achievedNum } = rowProgress(r);
    if (targetNum != null && targetNum > 0) {
      sumAchieved += achievedNum;
      sumTarget += targetNum;
      withTarget++;
      if (pct != null) pcts.push(pct);
    }
  }
  const avgPct =
    pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  return { sumAchieved, sumTarget, avgPct, withTarget };
}

function overallStats(results: FitnessAssessmentResult[]) {
  const pcts: number[] = [];
  for (const r of results) {
    const { pct } = rowProgress(r);
    if (pct != null) pcts.push(pct);
  }
  const avg =
    pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  return { avgPct: avg, letter: avg != null ? percentToLetter(avg) : null };
}

export function FitnessAssessmentResultContent({
  studentName,
  results,
  comments = null,
  isLoading,
  studentHeight = null,
  studentWeight = null,
  eventName = null,
  variant = 'full',
}: ResultContentProps) {
  const groupedByCategory =
    results?.reduce(
      (acc, result) => {
        const key = categoryKey(result);
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      },
      {} as Record<string, FitnessAssessmentResult[]>
    ) || {};

  const getEventDate = () => {
    if (!results || results.length === 0) return '';
    return new Date(results[0].eventDate).toISOString().split('T')[0];
  };

  const latestComment = comments && comments.length > 0 ? comments[0] : null;
  const resultsWithRemarks = (results ?? []).filter(
    (r) => r.remark != null && String(r.remark).trim() !== ''
  );
  const showHeight = studentHeight != null && studentHeight !== undefined;
  const showWeight = studentWeight != null && studentWeight !== undefined;

  const categoryNames = Object.keys(groupedByCategory).sort((a, b) =>
    a.localeCompare(b)
  );
  const { avgPct: overallAvgPct, letter: overallLetter } = results?.length
    ? overallStats(results)
    : { avgPct: null, letter: null };

  const handleExportPdf = () => {
    if (typeof window !== 'undefined') window.print();
  };

  const handleShare = async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
    }
  };

  const pageShell = variant === 'full';

  return (
    <div
      className={cn(
        'space-y-6',
        pageShell &&
          'max-md:bg-[#0E0E10] max-md:p-4 md:rounded-xl md:border md:border-stone-200/80 md:bg-[#f7f4ed] md:p-4 sm:md:p-6 dark:md:border-stone-800 dark:md:bg-stone-950/40',
        !pageShell && 'max-md:bg-[#0E0E10] max-md:p-1'
      )}
    >
      <h2 className="sr-only">Fitness Assessment Result - {studentName}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 max-md:min-h-[40vh]">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground max-md:text-[#8E8E93]" />
        </div>
      ) : !results || results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 py-12 text-center text-muted-foreground dark:border-stone-700 max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E] max-md:text-[#8E8E93]">
          No fitness assessment results found for this student
        </div>
      ) : (
        <>
          {pageShell ? (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-4 shadow-sm md:hidden">
                <div
                  className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(ellipse_85%_65%_at_100%_0%,rgba(190,255,65,0.22),transparent_52%)]"
                  aria-hidden
                />
                <div className="relative mt-1 flex items-start justify-between gap-3">
                  <h3 className="text-xl font-bold leading-tight text-white">
                    {eventName?.trim() ? eventName : 'Fitness Assessment'}
                  </h3>
                  <span className="shrink-0 rounded-full bg-[#DFFF00] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-black shadow-[0_0_16px_rgba(223,255,0,0.45)]">
                    Result
                  </span>
                </div>
                  <div className="relative mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-orange-400 to-orange-600 text-sm font-bold text-black shadow-md ring-1 ring-white/10">
                    {initialsFromName(studentName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{studentName}</p>
                    <p className="text-xs text-[#8E8E93]">Student · Fitness program</p>
                  </div>
                </div>
                {(showHeight || showWeight) && (
                  <p className="relative mt-3 text-xs text-[#8E8E93]">
                    {showHeight && <span>Height: {studentHeight}</span>}
                    {showHeight && showWeight && ' · '}
                    {showWeight && <span>Weight: {studentWeight}</span>}
                  </p>
                )}
                <p className="relative mt-2 text-xs text-[#8E8E93]">
                  {[eventName, getEventDate()].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="hidden flex-col gap-4 sm:flex-row sm:items-start sm:justify-between md:flex">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    Fitness Assessment Result — {studentName}
                  </h3>
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {[eventName, getEventDate()].filter(Boolean).join(' · ')}
                  </p>
                  {(showHeight || showWeight) && (
                    <p className="mt-2 text-xs text-stone-500">
                      {showHeight && <span>Height: {studentHeight}</span>}
                      {showHeight && showWeight && ' · '}
                      {showWeight && <span>Weight: {studentWeight}</span>}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-stone-300 bg-white dark:border-stone-600 dark:bg-stone-900"
                    onClick={handleExportPdf}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg border-stone-300 bg-white dark:border-stone-600 dark:bg-stone-900"
                    onClick={handleShare}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 border-b border-stone-200 pb-4 dark:border-stone-700 max-md:border-[#2C2C2E]">
              <div className="relative overflow-hidden rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] p-4 md:hidden">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                  Assessment
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">
                  {eventName?.trim() ? eventName : 'Fitness Assessment'}
                </h3>
                <p className="mt-2 text-xs text-[#8E8E93]">{getEventDate()}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-orange-400 to-orange-600 text-xs font-bold text-black shadow-md ring-1 ring-white/10">
                    {initialsFromName(studentName)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{studentName}</p>
                    <p className="text-xs text-[#8E8E93]">Student · Fitness program</p>
                  </div>
                </div>
              </div>
              <div className="hidden flex-wrap items-start gap-6 text-sm md:flex">
                {showHeight && (
                  <div>
                    <p className="text-muted-foreground">Height</p>
                    <p className="font-semibold">{studentHeight}</p>
                  </div>
                )}
                {showWeight && (
                  <div>
                    <p className="text-muted-foreground">Weight</p>
                    <p className="font-semibold">{studentWeight}</p>
                  </div>
                )}
                <div className="ml-auto text-right">
                  {eventName && <p className="mb-1 text-sm font-medium">{eventName}</p>}
                  <p className="text-sm font-medium">{getEventDate()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-stone-200/90 bg-stone-100/80 px-4 py-4 dark:border-stone-700 dark:bg-stone-900/50 max-md:rounded-2xl max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 max-md:text-[#8E8E93]">
                Overall grade
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-stone-900 dark:text-stone-50 max-md:text-white">
                {overallLetter ?? '—'}
              </p>
              <p className="mt-2 text-xs text-stone-500 max-md:text-[#8E8E93]">
                {overallAvgPct != null ? gradeSubtext(overallAvgPct) : 'No numeric targets'}
              </p>
            </div>
            {categoryNames.slice(0, 2).map((name, idx) => {
              const agg = aggregateCategory(groupedByCategory[name] ?? []);
              const accent = CATEGORY_ACCENTS[idx % CATEGORY_ACCENTS.length];
              const showFraction =
                agg.sumTarget > 0 && agg.withTarget > 0;
              return (
                <div
                  key={name}
                  className="rounded-xl border border-stone-200/90 bg-stone-100/80 px-4 py-4 dark:border-stone-700 dark:bg-stone-900/50 max-md:rounded-2xl max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E]"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 max-md:text-[#8E8E93]">
                    {name} score
                  </p>
                  <p
                    className={cn(
                      'mt-2 text-2xl font-bold tabular-nums',
                      accent.value,
                      MOBILE_SCORE_NUM[idx % 2]
                    )}
                  >
                    {showFraction
                      ? `${Math.round(agg.sumAchieved)} / ${Math.round(agg.sumTarget)}`
                      : agg.avgPct != null
                        ? `${agg.avgPct}%`
                        : '—'}
                  </p>
                  <p className="mt-2 text-xs text-stone-500 max-md:text-[#8E8E93]">
                    {agg.avgPct != null ? `${agg.avgPct}% of target` : 'No comparable targets'}
                  </p>
                </div>
              );
            })}
            {categoryNames.length < 2 &&
              Array.from({ length: 2 - categoryNames.length }).map((_, i) => (
                <div
                  key={`pad-${i}`}
                  className="hidden rounded-xl border border-dashed border-stone-200/60 bg-stone-50/50 px-4 py-4 lg:block dark:border-stone-800 dark:bg-stone-900/20"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                    Category
                  </p>
                  <p className="mt-2 text-xl font-semibold text-stone-400">—</p>
                  <p className="mt-2 text-xs text-stone-400">—</p>
                </div>
              ))}
            <div className="rounded-xl border border-stone-200/90 bg-stone-100/80 px-4 py-4 dark:border-stone-700 dark:bg-stone-900/50 max-md:rounded-2xl max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 max-md:text-[#8E8E93]">
                Skills assessed
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-stone-900 dark:text-stone-50 max-md:text-white">
                {results.length}
              </p>
              <p className="mt-2 text-xs text-stone-500 max-md:text-[#8E8E93]">
                Across {categoryNames.length} categor
                {categoryNames.length === 1 ? 'y' : 'ies'}
              </p>
            </div>
          </div>

          {/* Per-category sections */}
          <div className="space-y-5 max-md:space-y-4">
            {categoryNames.map((catName, catIdx) => {
              const skills = groupedByCategory[catName] ?? [];
              const accent = CATEGORY_ACCENTS[catIdx % CATEGORY_ACCENTS.length];
              const agg = aggregateCategory(skills);
              const badgePct = agg.avgPct;
              const CatIcon = CATEGORY_ICONS[catIdx % CATEGORY_ICONS.length];
              const mobileBorder = MOBILE_CAT_BORDER[catIdx % MOBILE_CAT_BORDER.length];
              const mobileIconWrap = MOBILE_CAT_ICON_WRAP[catIdx % MOBILE_CAT_ICON_WRAP.length];
              const mobileTitle = MOBILE_CAT_TITLE[catIdx % MOBILE_CAT_TITLE.length];

              return (
                <div
                  key={catName}
                  className={cn(
                    'overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950',
                    'max-md:rounded-2xl max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E]',
                    mobileBorder,
                    'max-md:border-l-4'
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 px-4 py-3 dark:border-stone-800 max-md:border-[#2C2C2E] max-md:bg-[#141416]">
                    <span
                      className={cn(
                        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl md:hidden',
                        mobileIconWrap
                      )}
                      aria-hidden
                    >
                      <CatIcon className="h-5 w-5" />
                    </span>
                    <span
                      className={cn('hidden size-2.5 shrink-0 rounded-full md:inline-block', accent.dot)}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-base font-semibold text-stone-900 dark:text-stone-100',
                        mobileTitle
                      )}
                    >
                      {catName}
                    </span>
                    {badgePct != null && (
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-0.5 text-xs font-medium',
                          accent.badge,
                          'max-md:border-[#2C2C2E] max-md:bg-[#0E0E10] max-md:text-[#8E8E93]'
                        )}
                      >
                        {badgePct}% of target
                      </span>
                    )}
                    <span className="ml-auto text-xs text-stone-500 max-md:text-[#8E8E93]">
                      {skills.length} exercise{skills.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/90 dark:border-stone-800 dark:bg-stone-900/80">
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                            Skill
                          </th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                            Target value
                          </th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                            Achieved
                          </th>
                          <th className="min-w-[180px] px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                            Progress
                          </th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                            Remarks
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {skills.map((result) => {
                          const { pct, targetNum } = rowProgress(result);
                          const { badge, rest } = splitTargetLabel(result.targetValue);
                          const barPct = pct ?? 0;
                          return (
                            <tr
                              key={result.id}
                              className="border-b border-stone-100 last:border-0 dark:border-stone-800/80"
                            >
                              <td className="align-top px-4 py-3">
                                <p className="font-semibold text-stone-900 dark:text-stone-100">
                                  {result.skillName || '—'}
                                </p>
                                {result.unitOfMeasurement ? (
                                  <p className="mt-0.5 text-xs text-stone-500">
                                    Unit: {result.unitOfMeasurement}
                                  </p>
                                ) : null}
                              </td>
                              <td className="align-top px-4 py-3 text-stone-700 dark:text-stone-300">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {badge ? (
                                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-stone-200 bg-stone-50 px-1.5 text-xs font-medium text-stone-600 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-300">
                                      {badge}
                                    </span>
                                  ) : null}
                                  <span>{rest}</span>
                                </div>
                              </td>
                              <td
                                className={cn(
                                  'align-top px-4 py-3 font-semibold tabular-nums',
                                  pct != null && pct >= 60
                                    ? accent.value
                                    : 'text-stone-900 dark:text-stone-100'
                                )}
                              >
                                {result.achievedValue?.trim() ? result.achievedValue : '—'}
                              </td>
                              <td className="align-top px-4 py-3">
                                {pct != null ? (
                                  <div className="space-y-1.5">
                                    <Progress
                                      value={barPct}
                                      className="h-2 bg-stone-200 dark:bg-stone-800"
                                      indicatorClassName={accent.bar}
                                    />
                                    <div className="flex justify-between text-[10px] tabular-nums text-stone-500">
                                      <span>0</span>
                                      <span>{pct}%</span>
                                      <span>{targetNum ?? '—'}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-stone-400">—</span>
                                )}
                              </td>
                              <td className="align-top px-4 py-3 text-stone-600 dark:text-stone-400">
                                {result.remark?.trim() ? result.remark : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 p-3 md:hidden">
                    {skills.map((result) => {
                      const { pct, targetNum } = rowProgress(result);
                      const { badge, rest } = splitTargetLabel(result.targetValue);
                      const barPct = pct ?? 0;
                      const targetLine = [badge && `Grading: ${badge}`, rest && rest !== '—' ? `Target: ${rest}` : null]
                        .filter(Boolean)
                        .join(' · ');
                      return (
                        <div
                          key={result.id}
                          className="rounded-2xl border border-[#2C2C2E] bg-[#0E0E10] p-4"
                        >
                          <p className="font-semibold text-white">{result.skillName || '—'}</p>
                          {result.unitOfMeasurement ? (
                            <p className="mt-0.5 text-xs text-[#8E8E93]">
                              Unit: {result.unitOfMeasurement}
                            </p>
                          ) : null}
                          {targetLine ? (
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#141416] px-3 py-2.5">
                              <span
                                className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', accent.dot)}
                                aria-hidden
                              />
                              <p className="text-xs leading-relaxed text-[#8E8E93]">{targetLine}</p>
                            </div>
                          ) : null}
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                                Achieved value
                              </p>
                              <div className="mt-1.5 rounded-xl border border-white/10 bg-white px-3 py-2.5 text-sm font-semibold tabular-nums text-stone-900 shadow-inner">
                                {result.achievedValue?.trim() ? result.achievedValue : '—'}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                                Remarks
                              </p>
                              <div className="mt-1.5 min-h-[42px] rounded-xl border border-white/10 bg-white px-3 py-2.5 text-sm text-stone-800 shadow-inner">
                                {result.remark?.trim() ? result.remark : '—'}
                              </div>
                            </div>
                          </div>
                          {pct != null ? (
                            <div className="mt-4 space-y-1.5">
                              <Progress
                                value={barPct}
                                className="h-2 bg-[#2C2C2E]"
                                indicatorClassName={cn(
                                  accent.bar,
                                  'max-md:shadow-[0_0_12px_rgba(190,255,65,0.55)]',
                                )}
                              />
                              <div className="flex justify-between text-[10px] tabular-nums text-[#8E8E93]">
                                <span>0</span>
                                <span>{pct}%</span>
                                <span>{targetNum ?? '—'}</span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {resultsWithRemarks.length > 0 && (
            <div className="rounded-xl border border-stone-200/90 bg-white p-4 dark:border-stone-800 dark:bg-stone-950 max-md:rounded-2xl max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E]">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 max-md:text-[#8E8E93]">
                Remarks
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {resultsWithRemarks.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400 max-md:text-[#DFFF00]">
                      {r.skillName}
                    </span>
                    {(r.category ?? r.level) && (
                      <span className="ml-1 text-xs text-stone-500 max-md:text-[#8E8E93]">
                        ({r.category ?? r.level})
                      </span>
                    )}
                    :{' '}
                    <span className="text-stone-800 dark:text-stone-200 max-md:text-white/90">{r.remark}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 rounded-xl border border-stone-200/90 bg-stone-100/90 px-4 py-4 dark:border-stone-800 dark:bg-stone-900/60 max-md:relative max-md:rounded-2xl max-md:border-[#2C2C2E] max-md:bg-[#1C1C1E] max-md:shadow-[0_8px_24px_-12px_rgba(223,255,0,0.15)]">
            <MessageSquare
              className="mt-0.5 h-5 w-5 shrink-0 text-stone-500 max-md:text-[#8E8E93]"
              aria-hidden
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 max-md:text-[#8E8E93]">
                Comments
              </p>
              <p className="mt-1 font-semibold text-stone-900 dark:text-stone-100 max-md:text-white">
                Coach comments
              </p>
              {latestComment?.comment?.trim() ? (
                <>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-300 max-md:text-[#AEAEB2]">
                    {latestComment.comment}
                  </p>
                  <p className="mt-2 text-xs text-stone-500 max-md:text-[#8E8E93]">
                    {new Date(latestComment.commentdate).toLocaleDateString()}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-stone-500 max-md:text-[#8E8E93]">
                  No comments were added for this assessment session.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const FitnessAssessmentResults = ({
  open,
  onClose,
  studentName,
  results,
  comments = null,
  isLoading,
  studentHeight = null,
  studentWeight = null,
  eventName = null,
}: FitnessAssessmentResultsProps) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Fitness Assessment Result - {studentName}</DialogTitle>
      </DialogHeader>
      <div className="py-2">
        <FitnessAssessmentResultContent
          studentName={studentName}
          results={results}
          comments={comments}
          isLoading={isLoading}
          studentHeight={studentHeight}
          studentWeight={studentWeight}
          eventName={eventName}
          variant="compact"
        />
      </div>
    </DialogContent>
  </Dialog>
);

export default FitnessAssessmentResults;
