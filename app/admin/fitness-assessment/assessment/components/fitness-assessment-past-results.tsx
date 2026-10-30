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

export type FitnessPastResultScore = {
  id: number;
  fitnessSkillId: number;
  skillName: string;
  level: string;
  score: number;
  achievedValue?: string | null;
  remark: string | null;
};

export type FitnessPastResultEvent = {
  eventId: number;
  eventDate: string;
  scores: FitnessPastResultScore[];
};

export type FitnessAssessmentPastResultsContentProps = {
  studentName: string;
  events: FitnessPastResultEvent[] | null;
  isLoading: boolean;
};

export function FitnessAssessmentPastResultsContent({
  studentName,
  events,
  isLoading,
}: FitnessAssessmentPastResultsContentProps) {
  const rowKeys = (events ?? []).reduce<Array<{ level: string; skillName: string }>>(
    (acc, ev) => {
      for (const s of ev.scores) {
        if (!acc.some((r) => r.level === s.level && r.skillName === s.skillName)) {
          acc.push({ level: s.level, skillName: s.skillName });
        }
      }
      return acc;
    },
    []
  );

  rowKeys.sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    return a.skillName.localeCompare(b.skillName);
  });

  const byLevel = rowKeys.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.level]) acc[row.level] = [];
    acc[row.level].push(row.skillName);
    return acc;
  }, {});

  const getScoreForRow = (
    level: string,
    skillName: string,
    ev: FitnessPastResultEvent
  ): FitnessPastResultScore | null =>
    ev.scores.find((s) => s.level === level && s.skillName === skillName) ?? null;

  const hasData = events && events.length > 0 && rowKeys.length > 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Past Fitness Performance - {studentName}</h2>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !hasData ? (
        <div className="text-center py-8 text-muted-foreground">
          No past fitness assessment results found for this student
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto border-blue-200">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-muted border-b-2 border-blue-400">
                <TableHead
                  rowSpan={2}
                  className="w-[120px] font-semibold align-middle sticky left-0 bg-muted z-10 border-r"
                >
                  Level
                </TableHead>
                <TableHead
                  rowSpan={2}
                  className="min-w-[180px] font-semibold align-middle sticky left-[120px] bg-muted z-10 border-r"
                >
                  Skill
                </TableHead>
                {events!.map((ev, evIdx) => (
                  <TableHead
                    key={`${ev.eventId}-${ev.eventDate}`}
                    colSpan={2}
                    className={`text-center font-semibold align-middle border-r ${evIdx === events!.length - 1 ? 'border-r-0' : ''}`}
                  >
                    {ev.eventDate}
                  </TableHead>
                ))}
              </TableRow>
              <TableRow className="bg-muted border-b border-blue-400">
                {events!.map((ev, evIdx) => {
                  const isLastEvent = evIdx === events!.length - 1;
                  return (
                    <Fragment key={`sub-${ev.eventId}-${ev.eventDate}`}>
                      <TableHead className="w-[100px] text-center font-semibold border-r">
                        Achieved
                      </TableHead>
                      <TableHead
                        className={`w-[120px] text-center font-semibold border-r ${isLastEvent ? 'border-r-0' : ''}`}
                      >
                        Remarks
                      </TableHead>
                    </Fragment>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(byLevel).map(([levelName, skills]) => (
                <Fragment key={levelName}>
                  {skills.map((skillName, skillIndex) => (
                    <TableRow
                      key={`${levelName}-${skillName}`}
                      className={skillIndex === 0 ? 'border-t-2 border-t-blue-400' : ''}
                    >
                      {skillIndex === 0 ? (
                        <TableCell
                          rowSpan={skills.length}
                          className="font-semibold text-blue-600 align-top border-r sticky left-0 bg-background z-10"
                        >
                          {levelName}
                        </TableCell>
                      ) : null}
                      <TableCell className="bg-blue-50 align-top border-r sticky left-[120px] bg-blue-50 z-10">
                        {skillName}
                      </TableCell>
                      {events!.map((ev, evIdx) => {
                        const scoreRow = getScoreForRow(levelName, skillName, ev);
                        const isLastEvent = evIdx === events!.length - 1;
                        return (
                          <Fragment key={`${ev.eventId}-${ev.eventDate}`}>
                            <TableCell
                              className={`text-center align-top border-r ${isLastEvent ? '' : ''}`}
                            >
                              {scoreRow?.achievedValue ?? '—'}
                            </TableCell>
                            <TableCell
                              className={`text-muted-foreground align-top border-r ${isLastEvent ? 'border-r-0' : ''}`}
                            >
                              {scoreRow?.remark ?? '—'}
                            </TableCell>
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

export default FitnessAssessmentPastResultsContent;
