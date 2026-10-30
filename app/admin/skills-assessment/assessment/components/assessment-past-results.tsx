'use client';

import { Fragment } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

export type PastResultScore = {
  id: number;
  skillId: number;
  skillName: string;
  apparatusName: string;
  level: string | null;
  score: number;
  remark: string | null;
  color: string | null;
};

export type PastResultEvent = {
  eventId: number;
  eventDate: string;
  scores: PastResultScore[];
};

export type AssessmentPastResultsContentProps = {
  studentName: string;
  events: PastResultEvent[] | null;
  isLoading: boolean;
};

// Default colors for each rating when skill.color is not present (Learning, Average, Good, Excellent)
const DEFAULT_RATING_COLORS: Record<number, string> = {
  1: '#fef3c7', // Learning - amber-100
  2: '#93c5fd', // Average - light blue (per image)
  3: '#86efac', // Good - green-300
  4: '#22c55e', // Excellent - green-500
};

const SCORE_TO_INDEX: Record<number, number> = {
  1: 0, // Learning
  2: 1, // Average
  3: 2, // Good
  4: 3, // Excellent
};

function getScoreColor(score: number, skillColor: string | null): string {
  if (skillColor && skillColor.trim()) return skillColor;
  return DEFAULT_RATING_COLORS[score] ?? '#e5e7eb';
}

function isColorLight(hex: string): boolean {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function AssessmentPastResultsContent({
  studentName,
  events,
  isLoading,
}: AssessmentPastResultsContentProps) {
  // Build unique (apparatusName, skillName) rows from all events, then group by apparatus
  const rowKeys = (events ?? []).reduce<Array<{ apparatusName: string; skillName: string }>>(
    (acc, ev) => {
      for (const s of ev.scores) {
        if (!acc.some((r) => r.apparatusName === s.apparatusName && r.skillName === s.skillName)) {
          acc.push({ apparatusName: s.apparatusName, skillName: s.skillName });
        }
      }
      return acc;
    },
    [],
  );

  rowKeys.sort((a, b) => {
    if (a.apparatusName !== b.apparatusName) return a.apparatusName.localeCompare(b.apparatusName);
    return a.skillName.localeCompare(b.skillName);
  });

  // Group by apparatus: { apparatusName: [skillName, ...] }
  const byApparatus = rowKeys.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.apparatusName]) acc[row.apparatusName] = [];
    acc[row.apparatusName].push(row.skillName);
    return acc;
  }, {});

  const getScoreForRow = (apparatusName: string, skillName: string, ev: PastResultEvent): PastResultScore | null =>
    ev.scores.find((s) => s.apparatusName === apparatusName && s.skillName === skillName) ?? null;

  const getEventLevel = (ev: PastResultEvent): string =>
    ev.scores[0]?.level ?? '';

  const hasData = events && events.length > 0 && rowKeys.length > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Past Performance - {studentName}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-8 text-muted-foreground">
          No past assessment results found for this student
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto border-blue-200">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted border-b-2 border-blue-400">
                <TableHead
                  rowSpan={2}
                  className="w-[150px] font-semibold align-middle sticky left-0 bg-muted z-10 border-r"
                >
                  Apparatus
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="min-w-[180px] font-semibold align-middle sticky left-[150px] bg-muted z-10 border-r"
                >
                  Skill
                </TableHead>
                {events!.map((ev, evIdx) => (
                  <TableHead
                    key={`${ev.eventId}-${ev.eventDate}`}
                    colSpan={4}
                    className={`text-center font-semibold align-middle border-r ${evIdx === events!.length - 1 ? 'border-r-0' : ''}`}
                  >
                    {ev.eventDate}
                    {getEventLevel(ev) ? ` (Level ${getEventLevel(ev)})` : ''}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="bg-muted border-b border-blue-400">
                {events!.map((ev, evIdx) => {
                  const isLastEvent = evIdx === events!.length - 1;
                  return (
                    <Fragment key={`sub-${ev.eventId}-${ev.eventDate}`}>
                      <TableHead className="w-[80px] text-center font-semibold border-r">
                        Learning
                      </TableHead>
                      <TableHead className="w-[80px] text-center font-semibold border-r">
                        Average
                      </TableHead>
                      <TableHead className="w-[80px] text-center font-semibold border-r">
                        Good
                      </TableHead>
                      <TableHead className={`w-[80px] text-center font-semibold border-r ${isLastEvent ? 'border-r-0' : ''}`}>
                        Excellent
                      </TableHead>
                    </Fragment>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(byApparatus).map(([apparatusName, skills]) => (
                <Fragment key={apparatusName}>
                  {skills.map((skillName, skillIndex) => (
                    <TableRow
                      key={`${apparatusName}-${skillName}`}
                      className={skillIndex === 0 ? 'border-t-2 border-t-blue-400' : ''}
                    >
                      {skillIndex === 0 ? (
                        <TableCell
                          rowSpan={skills.length}
                          className="font-semibold text-blue-600 align-top border-r sticky left-0 bg-background z-10"
                        >
                          {apparatusName}
                        </TableCell>
                      ) : null}
                      <TableCell className="bg-blue-50 align-top border-r sticky left-[150px] bg-blue-50 z-10">
                        {skillName}
                      </TableCell>
                      {events!.map((ev, evIdx) => {
                        const scoreRow = getScoreForRow(apparatusName, skillName, ev);
                        const scoreIndex = scoreRow ? SCORE_TO_INDEX[scoreRow.score] ?? -1 : -1;
                        const fillColor = scoreRow ? getScoreColor(scoreRow.score, scoreRow.color) : undefined;
                        const isLastEvent = evIdx === events!.length - 1;
                        return (
                          <Fragment key={`${ev.eventId}-${ev.eventDate}`}>
                            {[0, 1, 2, 3].map((checkIndex) => {
                              const isChecked = scoreIndex === checkIndex;
                              const bgColor = isChecked && fillColor ? fillColor : undefined;
                              const checkColor = bgColor
                                ? isColorLight(bgColor)
                                  ? '#1f2937'
                                  : '#fff'
                                : undefined;
                              const isLastCol = isLastEvent && checkIndex === 3;
                              return (
                                <TableCell
                                  key={checkIndex}
                                  className={`text-center align-top border-r ${isLastCol ? 'border-r-0' : ''}`}
                                >
                                  <div className="flex justify-center">
                                    <span
                                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300"
                                      style={
                                        bgColor
                                          ? {
                                              backgroundColor: bgColor,
                                              borderColor: bgColor,
                                              color: checkColor,
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
                          </Fragment>
                        );
                      })}
                    </TableRow>
                  ))}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default AssessmentPastResultsContent;
