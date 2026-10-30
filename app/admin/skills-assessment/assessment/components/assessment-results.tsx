'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Fragment } from 'react';
import { Loader2, Award, CircleDot, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AssessmentResult = {
  id: number;
  studentId: number;
  skillId: number;
  skillName: string;
  apparatusName: string;
  level: string | null;
  score: number;
  remark: string | null;
  eventDate: string;
  color?: string | null;
};

export type AssessmentComment = {
  id: number;
  eventid: number;
  tenantId: number;
  studentId: number;
  commentdate: string;
  comment: string | null;
};

type AssessmentResultsProps = {
  open: boolean;
  onClose: () => void;
  studentName: string;
  results: AssessmentResult[] | null;
  comments?: AssessmentComment[] | null;
  isLoading: boolean;
  studentHeight?: number | null;
  studentWeight?: number | null;
  eventName?: string | null;
  levelName?: string | null;
};

export type AssessmentResultContentProps = {
  studentName: string;
  results: AssessmentResult[] | null;
  comments?: AssessmentComment[] | null;
  isLoading: boolean;
  studentHeight?: number | null;
  studentWeight?: number | null;
  eventName?: string | null;
  levelName?: string | null;
  /** `full` = page shell (beige panel); `compact` = dialog / embedded */
  variant?: 'full' | 'compact';
};

const scoreToIndex: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
};

// Default colors per rating when skill.color is not set (Learning, Average, Good, Excellent)
const DEFAULT_RATING_COLORS: Record<number, string> = {
  1: '#fde68a',
  2: '#cbd5e1',
  3: '#86efac',
  4: '#16a34a',
};

const APPARATUS_ACCENTS = [
  'border-l-emerald-600',
  'border-l-orange-500',
  'border-l-amber-500',
  'border-l-rose-500',
] as const;

/** Light mobile: subtle violet / purple rails (reference app style). */
const MOBILE_APP_BORDER = [
  'max-md:border-l-violet-500',
  'max-md:border-l-purple-400',
] as const;

const MOBILE_APP_ICON_WRAP = [
  'max-md:bg-violet-100 max-md:text-violet-700',
  'max-md:bg-purple-100 max-md:text-purple-700',
] as const;

const APPARATUS_ICONS = [Award, CircleDot, Sparkles, Target] as const;

function initialsFromName(name: string): string {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getScoreColor(score: number, skillColor: string | null | undefined): string {
  if (skillColor && String(skillColor).trim()) return skillColor;
  return DEFAULT_RATING_COLORS[score] ?? '#e5e7eb';
}

function isColorLight(hex: string): boolean {
  const h = String(hex).replace(/^#/, '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function AssessmentResultContent({
  studentName,
  results,
  comments = null,
  isLoading,
  studentHeight = null,
  studentWeight = null,
  eventName = null,
  levelName = null,
  variant = 'full',
}: AssessmentResultContentProps) {
  const groupedByApparatus =
    results?.reduce(
      (acc, result) => {
        if (!acc[result.apparatusName]) {
          acc[result.apparatusName] = [];
        }
        acc[result.apparatusName].push(result);
        return acc;
      },
      {} as Record<string, AssessmentResult[]>
    ) || {};

  const getEventDate = () => {
    if (!results || results.length === 0) return '';
    return new Date(results[0].eventDate).toISOString().split('T')[0];
  };

  const getLevelDisplay = () => {
    if (levelName && String(levelName).trim()) return levelName;
    if (!results || results.length === 0) return '';
    return results[0].level || '';
  };

  const renderScoreCheckbox = (resultScore: number, checkIndex: number) => {
    const scoreIndex = scoreToIndex[resultScore];
    return scoreIndex === checkIndex;
  };

  const latestComment = comments && comments.length > 0 ? comments[0] : null;
  const resultsWithRemarks = (results ?? []).filter(
    (r) => r.remark != null && String(r.remark).trim() !== ''
  );
  const showHeight = studentHeight != null && studentHeight !== undefined;
  const showWeight = studentWeight != null && studentWeight !== undefined;

  return (
    <div
      className={cn(
        'space-y-6',
        variant === 'full' &&
          'max-md:bg-[#F7F6F2] max-md:p-4 md:rounded-xl md:border md:border-stone-200/80 md:bg-[#f7f4ed] md:p-4 sm:md:p-6 dark:md:border-stone-800 dark:md:bg-stone-950/40',
        variant !== 'full' && 'max-md:bg-[#F7F6F2] max-md:p-1'
      )}
    >
      <h2 className="sr-only">Assessment Result - {studentName}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 max-md:min-h-[40vh]">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground max-md:text-violet-600" />
        </div>
      ) : !results || results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-200 py-12 text-center text-muted-foreground dark:border-stone-700 max-md:rounded-2xl max-md:border-stone-300 max-md:bg-white">
          No assessment results found for this student
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm md:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              Assessment
            </p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <h3 className="font-serif text-xl font-bold leading-tight text-stone-900">
                {eventName?.trim() ? eventName : 'Skills Assessment'}
              </h3>
              <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                Active
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#635BFF] text-sm font-bold text-white shadow-inner ring-1 ring-black/5">
                {initialsFromName(studentName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-stone-900">{studentName}</p>
                <p className="text-xs text-stone-500">
                  Student · Skills program
                  {getLevelDisplay() ? ` · ${getLevelDisplay()}` : ''}
                </p>
              </div>
            </div>
            {(showHeight || showWeight) && (
              <p className="mt-3 text-xs text-stone-500">
                {showHeight && <span>Height: {studentHeight}</span>}
                {showHeight && showWeight && ' · '}
                {showWeight && <span>Weight: {studentWeight}</span>}
              </p>
            )}
            <p className="mt-2 text-xs text-stone-500">
              {getEventDate()}
              {eventName ? ` · ${eventName}` : ''}
            </p>
          </div>

          <div className="hidden space-y-2 border-b border-stone-200 pb-4 dark:border-stone-700 md:block">
            <div className="flex flex-wrap items-start gap-6 text-sm">
              {showHeight && (
                <div>
                  <p className="text-stone-500 dark:text-stone-400">Height</p>
                  <p className="font-semibold text-stone-900 dark:text-stone-100">{studentHeight}</p>
                </div>
              )}
              {showWeight && (
                <div>
                  <p className="text-stone-500 dark:text-stone-400">Weight</p>
                  <p className="font-semibold text-stone-900 dark:text-stone-100">{studentWeight}</p>
                </div>
              )}
              <div className="ml-auto text-right">
                {eventName && (
                  <p className="mb-1 text-sm font-medium text-stone-900 dark:text-stone-100">{eventName}</p>
                )}
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                  {getEventDate()}
                  {getLevelDisplay() && ` (Level: ${getLevelDisplay()})`}
                </p>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950 md:block">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="border-b border-stone-200 bg-stone-50/90 hover:bg-stone-50/90 dark:border-stone-800 dark:bg-stone-900/80 dark:hover:bg-stone-900/80">
                  <TableHead className="w-[150px] text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Apparatus
                  </TableHead>
                  <TableHead className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Skill
                  </TableHead>
                  <TableHead className="w-[80px] text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Learning
                  </TableHead>
                  <TableHead className="w-[80px] text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Average
                  </TableHead>
                  <TableHead className="w-[80px] text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Good
                  </TableHead>
                  <TableHead className="w-[80px] text-center text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    Excellent
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedByApparatus).map(
                  ([apparatusName, skills], apparatusIndex) => (
                    <Fragment key={apparatusIndex}>
                      {skills.map((result, skillIndex) => {
                        const fillColor = getScoreColor(result.score, result.color);
                        const accent =
                          APPARATUS_ACCENTS[apparatusIndex % APPARATUS_ACCENTS.length];
                        return (
                          <TableRow
                            key={result.id}
                            className={cn(
                              'border-b border-stone-100 last:border-0 dark:border-stone-800/80',
                              skillIndex === 0 && 'border-t-2 border-t-stone-300 dark:border-t-stone-600'
                            )}
                          >
                            {skillIndex === 0 ? (
                              <TableCell
                                rowSpan={skills.length}
                                className={cn(
                                  'border-l-4 bg-stone-50/50 align-top font-semibold text-stone-900 dark:bg-stone-900/40 dark:text-stone-100',
                                  accent
                                )}
                              >
                                {apparatusName}
                              </TableCell>
                            ) : null}
                            <TableCell className="bg-stone-50/30 font-medium text-stone-900 dark:bg-stone-900/20 dark:text-stone-100">
                              {result.skillName}
                            </TableCell>
                            {[0, 1, 2, 3].map((checkIndex) => {
                              const isChecked = renderScoreCheckbox(result.score, checkIndex);
                              const bgColor = isChecked ? fillColor : undefined;
                              const textColor =
                                bgColor != null
                                  ? (isColorLight(bgColor) ? '#1f2937' : '#fff')
                                  : undefined;
                              return (
                                <TableCell key={checkIndex} className="text-center">
                                  <div className="flex justify-center">
                                    <span
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-stone-200 dark:border-stone-600"
                                      style={
                                        bgColor
                                          ? {
                                              backgroundColor: bgColor,
                                              borderColor: bgColor,
                                              color: textColor,
                                            }
                                          : { backgroundColor: 'transparent' }
                                      }
                                    >
                                      {isChecked ? (
                                        <svg
                                          className="h-3.5 w-3.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2.5}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      ) : null}
                                    </span>
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  )
                )}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-4 md:hidden">
            {Object.entries(groupedByApparatus).map(([apparatusName, skills], apparatusIndex) => {
              const AppIcon = APPARATUS_ICONS[apparatusIndex % APPARATUS_ICONS.length];
              const mobileBorder =
                MOBILE_APP_BORDER[apparatusIndex % 2];
              const iconWrap = MOBILE_APP_ICON_WRAP[apparatusIndex % 2];
              return (
                <div
                  key={apparatusName}
                  className={cn(
                    'overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm',
                    mobileBorder,
                    'border-l-4'
                  )}
                >
                  <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
                        iconWrap
                      )}
                      aria-hidden
                    >
                      <AppIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                        Apparatus
                      </p>
                      <p className="truncate font-serif text-base font-bold text-stone-900">{apparatusName}</p>
                      <p className="text-xs text-stone-500">
                        {skills.length} skill{skills.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {skills.map((result) => {
                      const fillColor = getScoreColor(result.score, result.color);
                      const ratingLabels = ['Learning', 'Average', 'Good', 'Excellent'] as const;
                      return (
                        <div key={result.id} className="p-4">
                          <p className="font-semibold text-stone-900">{result.skillName}</p>
                          <div className="mt-3 grid grid-cols-4 gap-2">
                            {ratingLabels.map((label, checkIndex) => {
                              const isChecked = renderScoreCheckbox(result.score, checkIndex);
                              const bgColor = isChecked ? fillColor : undefined;
                              const textColor =
                                bgColor != null
                                  ? (isColorLight(bgColor) ? '#1f2937' : '#fff')
                                  : undefined;
                              return (
                                <div key={label} className="text-center">
                                  <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wide text-stone-500">
                                    {label.slice(0, 4)}
                                  </p>
                                  <div className="flex justify-center">
                                    <span
                                      className={cn(
                                        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 bg-white transition-colors',
                                        isChecked
                                          ? 'border-amber-400 bg-amber-50 shadow-sm'
                                          : 'border-stone-200 bg-white',
                                      )}
                                      style={
                                        bgColor
                                          ? {
                                              backgroundColor: bgColor,
                                              borderColor: isChecked ? '#f59e0b' : bgColor,
                                              color: textColor,
                                            }
                                          : undefined
                                      }
                                    >
                                      {isChecked ? (
                                        <svg
                                          className="h-4 w-4"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={2.5}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      ) : (
                                        <span className="h-3 w-3 rounded-full border border-stone-300 bg-stone-100" />
                                      )}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {resultsWithRemarks.length > 0 && (
            <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-950 max-md:rounded-2xl">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                Remarks
              </p>
              <ul className="space-y-1.5 text-sm">
                {resultsWithRemarks.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium text-violet-700 dark:text-violet-400">
                      {r.skillName}
                    </span>
                    {r.apparatusName && (
                      <span className="ml-1 text-xs text-stone-500">
                        ({r.apparatusName})
                      </span>
                    )}
                    :{' '}
                    <span className="text-stone-800 dark:text-stone-200">{r.remark}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latestComment && (
            <div className="rounded-xl border border-stone-200/90 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900/60 max-md:rounded-2xl">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                Comments
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                Comment
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                {latestComment.comment}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {new Date(latestComment.commentdate).toLocaleDateString()}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const AssessmentResults = ({
  open,
  onClose,
  studentName,
  results,
  comments = null,
  isLoading,
  studentHeight = null,
  studentWeight = null,
  eventName = null,
  levelName = null,
}: AssessmentResultsProps) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Assessment Result - {studentName}</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <AssessmentResultContent
          studentName={studentName}
          results={results}
          comments={comments}
          isLoading={isLoading}
          studentHeight={studentHeight}
          studentWeight={studentWeight}
          eventName={eventName}
          levelName={levelName}
          variant="compact"
        />
      </div>
    </DialogContent>
  </Dialog>
);

export default AssessmentResults;