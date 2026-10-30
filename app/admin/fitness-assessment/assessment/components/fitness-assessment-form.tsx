 'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, Ruler } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type GradingCriterion = {
  id?: number;
  level: string;
  description: string | null;
  targetValue: string | null;
};

type FitnessSkill = {
  id: number;
  name: string;
  level: string;
  description?: string | null;
  orderSequence?: number;
  unitOfMeasurement?: string;
  gradingCriteria?: GradingCriterion[];
};

type LevelGroup = {
  id: string;
  name: string;
  shortName: string;
  level: string;
  skills: FitnessSkill[];
};

type FitnessAssessmentFormProps = {
  open?: boolean;
  onClose?: () => void;
  studentId: string;
  studentName: string;
  eventId?: number;
  asPage?: boolean;
  redirectPath?: string;
};

type SkillRating = {
  fitnessSkillId: number;
  achievedValue: string;
  remarks: string;
};

const FitnessAssessmentForm = ({
  open = true,
  onClose,
  studentId,
  studentName,
  eventId,
  asPage = false,
  redirectPath = '/admin/fitness-assessment/assessment',
}: FitnessAssessmentFormProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>(
    eventId ? String(eventId) : ''
  );
  const [comments, setComments] = useState('');
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [skillRatings, setSkillRatings] = useState<Record<number, SkillRating>>({});
  const [heightWeightOpen, setHeightWeightOpen] = useState(false);
  const [heightValue, setHeightValue] = useState('');
  const [weightValue, setWeightValue] = useState('');

  const { data: eventsData } = useQuery({
    queryKey: ['fitness-assessment-events-select'],
    queryFn: async () => {
      const url = withParams(API_PATHS.eventManagement.events.select, 'eventType=fitness-assessment');
      const response = await apiFetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
    enabled: open || asPage,
  });

  const { data: skillsData, isLoading: isLoadingSkills } = useQuery({
    queryKey: ['fitness-assessment-skills', studentId],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.fitnessAssessment.skills);
      if (!response.ok) throw new Error('Failed to fetch fitness skills');
      return response.json();
    },
    enabled: (open || asPage) && !!studentId,
  });

  const { data: registrationDetails } = useQuery({
    queryKey: ['registration-details', studentId, selectedEventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.eventManagement.registerGymnast.details, `studentId=${studentId}&eventId=${selectedEventId}`)
      );
      if (!response.ok) throw new Error('Failed to fetch registration');
      return response.json();
    },
    enabled: !!selectedEventId && !!studentId,
  });

  const { data: existingResultData } = useQuery({
    queryKey: ['fitness-assessment-result', studentId, selectedEventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.fitnessAssessment.assessment.result, `studentId=${studentId}&eventId=${selectedEventId}`)
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedEventId && !!studentId && (open || asPage),
  });

  useEffect(() => {
    if (heightWeightOpen && registrationDetails) {
      setHeightValue(registrationDetails.height != null ? String(registrationDetails.height) : '');
      setWeightValue(registrationDetails.weight != null ? String(registrationDetails.weight) : '');
    }
  }, [heightWeightOpen, registrationDetails]);

  const heightWeightMutation = useMutation({
    mutationFn: async () => {
      const height = heightValue.trim() ? parseFloat(heightValue) : null;
      const weight = weightValue.trim() ? parseFloat(weightValue) : null;
      const res = await apiFetch(
        withParams(API_PATHS.eventManagement.registerGymnast.details, `studentId=${studentId}&eventId=${selectedEventId}`),
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ height, weight }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Height and weight saved');
      setHeightWeightOpen(false);
      queryClient.invalidateQueries({ queryKey: ['registration-details', studentId, selectedEventId] });
      queryClient.invalidateQueries({ queryKey: ['fitness-assessment'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save height and weight');
    },
  });

  const saveHeightWeight = () => {
    const h = heightValue.trim();
    const w = weightValue.trim();
    if (!h && !w) {
      toast.error('Enter at least height or weight');
      return;
    }
    if (h && (Number.isNaN(parseFloat(h)) || parseFloat(h) < 0)) {
      toast.error('Invalid height');
      return;
    }
    if (w && (Number.isNaN(parseFloat(w)) || parseFloat(w) < 0)) {
      toast.error('Invalid weight');
      return;
    }
    heightWeightMutation.mutate();
  };

  useEffect(() => {
    if (open || asPage) {
      setSelectedEventId(eventId ? String(eventId) : '');
      setComments('');
      setExpandedLevels(new Set());
      setSkillRatings({});
    }
  }, [open, asPage, eventId]);

  const levelList: LevelGroup[] = useMemo(() => skillsData?.data || [], [skillsData?.data]);

  useEffect(() => {
    const results = existingResultData?.data;
    const assessmentComments = existingResultData?.comments;
    if (!results || !Array.isArray(results) || levelList.length === 0) return;

    const ratings: Record<number, SkillRating> = {};
    const levelsToExpand = new Set<string>();

    for (const item of results as { fitnessSkillId: number; achievedValue?: string | null; remark?: string | null }[]) {
      ratings[item.fitnessSkillId] = {
        fitnessSkillId: item.fitnessSkillId,
        achievedValue: item.achievedValue?.trim() ?? '',
        remarks: item.remark?.trim() ?? '',
      };
      const grp = levelList.find((l) => l.skills?.some((s) => s.id === item.fitnessSkillId));
      if (grp) levelsToExpand.add(grp.id);
    }

    setSkillRatings(ratings);
    setExpandedLevels(levelsToExpand);

    if (assessmentComments && Array.isArray(assessmentComments) && assessmentComments.length > 0) {
      const latestComment = assessmentComments[0] as { comment?: string | null };
      setComments(latestComment.comment?.trim() ?? '');
    }
  }, [existingResultData, levelList]);

  const toggleLevel = (levelId: string) => {
    const next = new Set(expandedLevels);
    if (next.has(levelId)) next.delete(levelId);
    else next.add(levelId);
    setExpandedLevels(next);
  };

  const handleAchievedValueChange = (fitnessSkillId: number, achievedValue: string) => {
    setSkillRatings((prev) => ({
      ...prev,
      [fitnessSkillId]: {
        ...prev[fitnessSkillId],
        fitnessSkillId,
        achievedValue,
        remarks: prev[fitnessSkillId]?.remarks || '',
      },
    }));
  };

  const handleRemarksChange = (fitnessSkillId: number, remarks: string) => {
    setSkillRatings((prev) => ({
      ...prev,
      [fitnessSkillId]: {
        ...prev[fitnessSkillId],
        fitnessSkillId,
        achievedValue: prev[fitnessSkillId]?.achievedValue ?? '',
        remarks,
      },
    }));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(API_PATHS.fitnessAssessment.submit, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          eventId: selectedEventId ? parseInt(selectedEventId) : null,
          comments,
          skillRatings: Object.values(skillRatings).filter((sr) => sr.achievedValue.trim() !== ''),
        }),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to submit fitness assessment');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Fitness assessment submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['fitness-assessment'] });
      if (asPage) {
        router.push(redirectPath);
      } else if (onClose) {
        onClose();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to submit assessment');
    },
  });

  const handleSubmit = () => {
    if (!selectedEventId) {
      toast.error('Please select a fitness assessment event');
      return;
    }

    const hasValues = Object.values(skillRatings).some((sr) => sr.achievedValue.trim() !== '');

    if (!hasValues) {
      toast.error('Please enter achieved value for at least one fitness skill');
      return;
    }

    submitMutation.mutate();
  };

  const formContent = (
    <div className="space-y-6 py-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="grid grid-cols-2 gap-2 flex-1 min-w-[200px]">
          <div className="space-y-2">
            <Label htmlFor="assessment">Assessment</Label>
            <Input
              id="assessment"
              value={
                eventsData?.find((e: { id: number }) => String(e.id) === selectedEventId)?.name ??
                (selectedEventId ? `Event #${selectedEventId}` : '—')
              }
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label>Child:</Label>
            <Input value={studentName} readOnly className="bg-muted" />
          </div>
        </div>
        {eventsData?.length === 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            No fitness assessment events found. Create an event with type &quot;Fitness Assessment&quot; in Event Management.
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedEventId}
          onClick={() => setHeightWeightOpen(true)}
          className="shrink-0"
        >
          <Ruler className="h-4 w-4 mr-2" />
          Add Height & Weight
        </Button>
      </div>

      {registrationDetails && (registrationDetails.height != null || registrationDetails.weight != null) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground border rounded-md bg-muted/40 px-3 py-2">
          <span>
            Height: {registrationDetails.height != null ? `${registrationDetails.height} cm` : '—'}
          </span>
          <span>·</span>
          <span>
            Weight: {registrationDetails.weight != null ? `${registrationDetails.weight} kg` : '—'}
          </span>
        </div>
      )}

      <Dialog open={heightWeightOpen} onOpenChange={setHeightWeightOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Height & Weight</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                min={0}
                step={0.1}
                placeholder="e.g. 120"
                value={heightValue}
                onChange={(e) => setHeightValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                min={0}
                step={0.1}
                placeholder="e.g. 25"
                value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setHeightWeightOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveHeightWeight}
                disabled={heightWeightMutation.isPending}
              >
                {heightWeightMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        <Label htmlFor="comments">Comments:</Label>
        <Textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Enter comments..."
          rows={1}
        />
      </div>

      {isLoadingSkills ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : levelList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No fitness skills available. Add fitness skills in Administration.
        </div>
      ) : (
        <div className="space-y-4">
          {levelList.map((levelGroup) => {
            const isExpanded = expandedLevels.has(levelGroup.id);
            const levelSkills = levelGroup.skills || [];

            return (
              <div key={levelGroup.id} className="border rounded-lg">
                <button
                  type="button"
                  onClick={() => toggleLevel(levelGroup.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                    <span className="font-semibold text-lg">{levelGroup.shortName || levelGroup.name}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4">
                    {levelSkills.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No skills in this level
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {levelSkills.map((skill) => {
                          const achievedValue = skillRatings[skill.id]?.achievedValue ?? '';
                          const remarks = skillRatings[skill.id]?.remarks ?? '';

                          const unit = skill.unitOfMeasurement ?? '';
                          const criteria = skill.gradingCriteria ?? [];
                          return (
                            <div key={skill.id} className="border-b pb-4 last:border-b-0">
                              <div className="flex items-start gap-3 flex-wrap">
                                <div className="min-w-[180px] pt-2">
                                  <Label className="text-sm font-medium">{skill.name}</Label>
                                  {unit && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Unit: {unit}</p>
                                  )}
                                  {criteria.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      <span className="text-xs font-medium text-muted-foreground">Workouts / Grading criteria:</span>
                                      <ul className="text-xs text-muted-foreground space-y-0.5 list-none pl-0">
                                        {criteria.map((g, idx) => (
                                          <li key={g.id ?? idx} className="border-l-2 border-muted pl-2 py-0.5">
                                            <span className="font-medium text-foreground">{g.level}</span>
                                            {(g.targetValue || g.description) && (
                                              <> · {[g.targetValue ? `Target: ${g.targetValue}` : '', g.description].filter(Boolean).join(' · ')}</>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-[140px]">
                                  <Label htmlFor={`achieved-${skill.id}`} className="text-xs text-muted-foreground">Achieved value</Label>
                                  <Input
                                    id={`achieved-${skill.id}`}
                                    value={achievedValue}
                                    onChange={(e) => handleAchievedValueChange(skill.id, e.target.value)}
                                    placeholder={unit ? `e.g. in ${unit}` : 'Value'}
                                    className="h-9 mt-0.5"
                                  />
                                </div>
                                <div className="w-[200px]">
                                  <Label htmlFor={`remarks-${skill.id}`} className="text-xs text-muted-foreground">Remarks</Label>
                                  <Input
                                    id={`remarks-${skill.id}`}
                                    value={remarks}
                                    onChange={(e) => handleRemarksChange(skill.id, e.target.value)}
                                    placeholder="Remarks..."
                                    className="h-9 mt-0.5"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t">
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="min-w-[120px]"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'SUBMIT'
          )}
        </Button>
      </div>
    </div>
  );

  if (asPage) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 -ml-2"
          onClick={() => router.push(redirectPath)}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Assessment List
        </Button>
        <div className="rounded-lg border bg-card p-6">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose ?? (() => {})}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default FitnessAssessmentForm;
