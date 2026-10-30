'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Ruler,
  Sparkles,
} from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const RATING_OPTIONS: {
  value: 'LEARNING' | 'AVERAGE' | 'GOOD' | 'EXCELLENT';
  short: string;
}[] = [
  { value: 'LEARNING', short: 'LEARN' },
  { value: 'AVERAGE', short: 'AVG' },
  { value: 'GOOD', short: 'GOOD' },
  { value: 'EXCELLENT', short: 'EXC' },
];

type Skill = {
  id: number;
  name: string;
  apparatusId: number;
  apparatusName: string;
  gender: string;
  level: string | null;
  color: string | null;
};

type Apparatus = {
  id: number;
  name: string;
  shortName: string | null;
  gender: string;
  sequence: number;
  skills: Skill[];
};

type AssessmentFormProps = {
  open?: boolean;
  onClose?: () => void;
  studentId: string;
  studentName: string;
  eventId?: number;
  /** When true, renders as full page (no dialog) with back button */
  asPage?: boolean;
  /** When asPage, path to redirect to after success and for back button */
  redirectPath?: string;
};

type SkillRating = {
  skillId: number;
  apparatusId: number;
  rating: 'LEARNING' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' | null;
  remarks: string;
};

// Score to rating mapping (reverse of submit: 1=LEARNING, 2=AVERAGE, 3=GOOD, 4=EXCELLENT)
const SCORE_TO_RATING: Record<number, 'LEARNING' | 'AVERAGE' | 'GOOD' | 'EXCELLENT'> = {
  1: 'LEARNING',
  2: 'AVERAGE',
  3: 'GOOD',
  4: 'EXCELLENT',
};

const AssessmentForm = ({
  open = true,
  onClose,
  studentId,
  studentName,
  eventId,
  asPage = false,
  redirectPath = '/admin/skills-assessment/assessment',
}: AssessmentFormProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>(
    eventId ? String(eventId) : ''
  );
  const [comments, setComments] = useState('');
  const [expandedApparatus, setExpandedApparatus] = useState<Set<number>>(
    new Set()
  );
  const [skillRatings, setSkillRatings] = useState<
    Record<number, SkillRating>
  >({});
  const [heightWeightOpen, setHeightWeightOpen] = useState(false);
  const [heightValue, setHeightValue] = useState('');
  const [weightValue, setWeightValue] = useState('');

  // Fetch events for dropdown
  const { data: eventsData } = useQuery({
    queryKey: ['assessment-events-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.eventManagement.events.select);
      if (!response.ok) throw new Error('Failed to fetch events');
      const events = await response.json();
      return events.filter(
        (e: { event_type?: string }) =>
          e.event_type && e.event_type.toLowerCase().includes('assessment')
      );
    },
    enabled: open || asPage,
  });

  // Fetch skills grouped by apparatus
  const { data: skillsData, isLoading: isLoadingSkills } = useQuery({
    queryKey: ['assessment-skills', studentId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.skillsAssessment.skills, `studentId=${studentId}`)
      );
      if (!response.ok) throw new Error('Failed to fetch skills');
      return response.json();
    },
    enabled: (open || asPage) && !!studentId,
  });

  // Fetch registration details for height/weight when dialog opens
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

  // Fetch existing assessment result to pre-fill form when already submitted
  const { data: existingResultData } = useQuery({
    queryKey: ['assessment-result', studentId, selectedEventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.skillsAssessment.assessment.result, `studentId=${studentId}&eventId=${selectedEventId}`)
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedEventId && !!studentId && (open || asPage),
  });

  // When dialog opens, populate inputs from current registration details
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
      queryClient.invalidateQueries({ queryKey: ['skills-assessment-assessment'] });
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

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open || asPage) {
      setSelectedEventId(eventId ? String(eventId) : '');
      setComments('');
      setExpandedApparatus(new Set());
      setSkillRatings({});
    }
  }, [open, asPage, eventId]);

  // Pre-fill form with stored result when assessment already submitted
  const apparatusList: Apparatus[] = useMemo(
    () => skillsData?.data || [],
    [skillsData?.data]
  );
  useEffect(() => {
    const results = existingResultData?.data;
    const assessmentComments = existingResultData?.comments;
    if (!results || !Array.isArray(results) || apparatusList.length === 0) return;

    // Build skillId -> apparatusId map from apparatus list
    const skillToApparatus: Record<number, number> = {};
    for (const apparatus of apparatusList) {
      for (const skill of apparatus.skills || []) {
        skillToApparatus[skill.id] = skill.apparatusId;
      }
    }

    const ratings: Record<number, SkillRating> = {};
    const apparatusToExpand = new Set<number>();

    for (const item of results as { skillId: number; score: number; remark?: string | null }[]) {
      const apparatusId = skillToApparatus[item.skillId] ?? 0;
      const rating = SCORE_TO_RATING[item.score] ?? null;
      ratings[item.skillId] = {
        skillId: item.skillId,
        apparatusId,
        rating,
        remarks: item.remark?.trim() ?? '',
      };
      if (apparatusId) apparatusToExpand.add(apparatusId);
    }

    setSkillRatings(ratings);
    setExpandedApparatus(apparatusToExpand);

    // Set comments from most recent assessment comment
    if (assessmentComments && Array.isArray(assessmentComments) && assessmentComments.length > 0) {
      const latestComment = assessmentComments[0] as { comment?: string | null };
      setComments(latestComment.comment?.trim() ?? '');
    }
  }, [existingResultData, apparatusList]);

  // Toggle apparatus expansion
  const toggleApparatus = (apparatusId: number) => {
    const newExpanded = new Set(expandedApparatus);
    if (newExpanded.has(apparatusId)) {
      newExpanded.delete(apparatusId);
    } else {
      newExpanded.add(apparatusId);
    }
    setExpandedApparatus(newExpanded);
  };

  // Handle skill rating change
  const handleRatingChange = (
    skillId: number,
    apparatusId: number,
    rating: 'LEARNING' | 'AVERAGE' | 'GOOD' | 'EXCELLENT' | null
  ) => {
    setSkillRatings((prev) => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        skillId,
        apparatusId,
        rating,
        remarks: prev[skillId]?.remarks || '',
      },
    }));
  };

  // Handle remarks change
  const handleRemarksChange = (skillId: number, apparatusId: number, remarks: string) => {
    setSkillRatings((prev) => ({
      ...prev,
      [skillId]: {
        ...prev[skillId],
        skillId,
        apparatusId,
        rating: prev[skillId]?.rating || null,
        remarks,
      },
    }));
  };

  const draftMutation = useMutation({
    mutationFn: async () => {
      const skills = apparatusList.flatMap((apparatus) => apparatus.skills);
      const scores = Object.values(skillRatings)
        .filter((row) => row.rating)
        .map((row) => ({
          skillName: skills.find((skill) => skill.id === row.skillId)?.name ?? 'Skill',
          rating: row.rating,
        }));
      const response = await apiFetch('/api/ai/comment-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, scores }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Could not draft a comment');
      }
      return payload as { draft: string; source: 'model' | 'rules' };
    },
    onSuccess: (result) => {
      setComments(result.draft);
      toast.success(
        result.source === 'model'
          ? 'Draft added. Edit it, then save the assessment.'
          : 'Draft added from the ratings. Edit it, then save the assessment.',
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Could not draft a comment');
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch(API_PATHS.skillsAssessment.submit, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          eventId: selectedEventId ? parseInt(selectedEventId) : null,
          comments,
          skillRatings: Object.values(skillRatings).filter(
            (sr) => sr.rating !== null
          ),
        }),
      });

      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message || 'Failed to submit assessment');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Assessment submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['skills-assessment'] });
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
      toast.error('Please select an assessment event');
      return;
    }

    const hasRatings = Object.values(skillRatings).some(
      (sr) => sr.rating !== null
    );

    if (!hasRatings) {
      toast.error('Please rate at least one skill');
      return;
    }

    submitMutation.mutate();
  };

  const eventDisplayName =
    eventsData?.find((e: { id: number }) => String(e.id) === selectedEventId)?.name ??
    (selectedEventId ? `Event #${selectedEventId}` : '—');

  const formContent = (
    <div className="space-y-4 py-2 md:space-y-6 md:py-4">
      {/* Assessment and Child Info + Add Height/Weight — desktop */}
      <div className="hidden items-start justify-between gap-4 md:flex flex-wrap">
        <div className="grid min-w-[200px] flex-1 grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="assessment">Assessment</Label>
            <Input
              id="assessment"
              value={eventDisplayName}
              readOnly
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label>Child:</Label>
            <Input value={studentName} readOnly className="bg-muted" />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedEventId}
          onClick={() => setHeightWeightOpen(true)}
          className="shrink-0"
        >
          <Ruler className="mr-2 h-4 w-4" />
          Add Height & Weight
        </Button>
      </div>

      {/* Mobile hero card */}
      <div className="rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm md:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Assessment</p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg font-bold leading-tight text-stone-900">
            {eventDisplayName}
          </h3>
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
            Active
          </span>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#635BFF] text-sm font-bold text-white shadow-inner ring-1 ring-black/5">
            {initialsFromName(studentName)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-stone-900">{studentName}</p>
            <p className="text-xs text-stone-500">Student · Skills assessment</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedEventId}
          onClick={() => setHeightWeightOpen(true)}
          className="mt-4 w-full border-2 border-dashed border-amber-700/35 bg-transparent text-stone-800 hover:bg-amber-50/50"
        >
          <Ruler className="mr-2 h-4 w-4" />
          Add Height & Weight
        </Button>
      </div>

      {/* Show existing height/weight below the button when present */}
      {registrationDetails && (registrationDetails.height != null || registrationDetails.weight != null) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-sm text-muted-foreground md:rounded-md md:border md:bg-muted/40">
          <span>
            Height: {registrationDetails.height != null ? `${registrationDetails.height} cm` : '—'}
          </span>
          <span>·</span>
          <span>
            Weight: {registrationDetails.weight != null ? `${registrationDetails.weight} kg` : '—'}
          </span>
        </div>
      )}

      {/* Height/Weight dialog */}
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
              <Button
                type="button"
                variant="outline"
                onClick={() => setHeightWeightOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={saveHeightWeight}
                disabled={heightWeightMutation.isPending}
              >
                {heightWeightMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments */}
      <div className="space-y-2 rounded-2xl border border-stone-200/90 bg-white p-4 shadow-sm md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor="comments"
            className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 md:text-sm md:normal-case md:tracking-normal"
          >
            Comments
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={draftMutation.isPending}
            onClick={() => draftMutation.mutate()}
          >
            {draftMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Draft comment
          </Button>
        </div>
        <Textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Write your assessment notes here..."
          rows={1}
          className="min-h-[100px] resize-y border-stone-200 bg-stone-50/80 md:min-h-0 md:bg-background"
        />
      </div>

      {/* Apparatus and Skills */}
      {isLoadingSkills ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : apparatusList.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No skills available for this student
        </div>
      ) : (
        <div className="space-y-4">
          {apparatusList.map((apparatus, apparatusIndex) => {
            const isExpanded = expandedApparatus.has(apparatus.id);
            const apparatusSkills = apparatus.skills || [];
            const iconWrap =
              apparatusIndex % 2 === 0
                ? 'bg-violet-100 text-violet-700'
                : 'bg-purple-100 text-purple-700';

            return (
              <div
                key={apparatus.id}
                className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm md:rounded-lg md:shadow-none"
              >
                <button
                  type="button"
                  onClick={() => toggleApparatus(apparatus.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/50 p-4 text-left transition-colors hover:bg-stone-100/80 md:border-0 md:bg-transparent md:p-4 md:hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex size-9 shrink-0 items-center justify-center rounded-xl',
                        iconWrap
                      )}
                      aria-hidden
                    >
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <span className="font-serif text-lg font-bold text-stone-900 md:font-sans md:font-semibold">
                        {apparatus.shortName || apparatus.name}
                      </span>
                      {eventDisplayName !== '—' && (
                        <p className="mt-0.5 text-xs font-medium text-stone-600 md:hidden">
                          {eventDisplayName}
                        </p>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 shrink-0 text-stone-500" />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-stone-500" />
                  )}
                </button>

                {isExpanded && (
                  <div className="space-y-4 border-t border-stone-100 p-4 md:border-t">
                    {apparatusSkills.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        No skills available for this apparatus
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {apparatusSkills.map((skill) => {
                          const rating = skillRatings[skill.id]?.rating || null;
                          const remarks = skillRatings[skill.id]?.remarks || '';

                          return (
                            <div
                              key={skill.id}
                              className="border-b border-stone-100 pb-6 last:border-b-0 last:pb-0 md:border-b md:pb-4 md:last:border-b-0"
                            >
                              {/* Mobile: stacked card-style skill row */}
                              <div className="md:hidden">
                                <p className="font-semibold text-stone-900">{skill.name}</p>
                                <div
                                  className="mt-3 grid grid-cols-4 gap-2"
                                  role="group"
                                  aria-label={`Rating for ${skill.name}`}
                                >
                                  {RATING_OPTIONS.map((opt) => {
                                    const selected = rating === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() =>
                                          handleRatingChange(
                                            skill.id,
                                            skill.apparatusId,
                                            opt.value
                                          )
                                        }
                                        className={cn(
                                          'flex flex-col items-center gap-1.5 rounded-xl border-2 px-0.5 py-2 text-[8px] font-semibold uppercase tracking-wide transition-colors',
                                          selected
                                            ? 'border-amber-400 bg-amber-50 text-stone-900 shadow-sm'
                                            : 'border-stone-200 bg-white text-stone-500'
                                        )}
                                      >
                                        <span
                                          className={cn(
                                            'h-3 w-3 rounded-full border-2',
                                            selected
                                              ? 'border-orange-500 bg-orange-500'
                                              : 'border-stone-300 bg-stone-100'
                                          )}
                                          aria-hidden
                                        />
                                        {opt.short}
                                      </button>
                                    );
                                  })}
                                </div>
                                <Input
                                  id={`remarks-mobile-${skill.id}`}
                                  value={remarks}
                                  onChange={(e) =>
                                    handleRemarksChange(
                                      skill.id,
                                      skill.apparatusId,
                                      e.target.value
                                    )
                                  }
                                  placeholder="Note for this skill..."
                                  className="mt-3 h-10 border-stone-200 bg-stone-50/80"
                                />
                              </div>

                              {/* Desktop: original row layout */}
                              <div className="hidden items-start gap-3 md:flex">
                                <div className="min-w-[120px] pt-2">
                                  <Label className="text-sm font-medium">{skill.name}</Label>
                                </div>
                                <div className="flex-1">
                                  <RadioGroup
                                    value={rating || ''}
                                    onValueChange={(value) =>
                                      handleRatingChange(
                                        skill.id,
                                        skill.apparatusId,
                                        value as
                                          | 'LEARNING'
                                          | 'AVERAGE'
                                          | 'GOOD'
                                          | 'EXCELLENT'
                                          | null
                                      )
                                    }
                                    className="flex flex-wrap gap-4"
                                  >
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="LEARNING"
                                        id={`${skill.id}-learning`}
                                      />
                                      <Label
                                        htmlFor={`${skill.id}-learning`}
                                        className="cursor-pointer font-normal"
                                      >
                                        LEARNING
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="AVERAGE"
                                        id={`${skill.id}-average`}
                                      />
                                      <Label
                                        htmlFor={`${skill.id}-average`}
                                        className="cursor-pointer font-normal"
                                      >
                                        AVERAGE
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="GOOD" id={`${skill.id}-good`} />
                                      <Label
                                        htmlFor={`${skill.id}-good`}
                                        className="cursor-pointer font-normal"
                                      >
                                        GOOD
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem
                                        value="EXCELLENT"
                                        id={`${skill.id}-excellent`}
                                      />
                                      <Label
                                        htmlFor={`${skill.id}-excellent`}
                                        className="cursor-pointer font-normal"
                                      >
                                        EXCELLENT
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                </div>
                                <div className="w-[200px]">
                                  <Input
                                    id={`remarks-${skill.id}`}
                                    value={remarks}
                                    onChange={(e) =>
                                      handleRemarksChange(
                                        skill.id,
                                        skill.apparatusId,
                                        e.target.value
                                      )
                                    }
                                    placeholder="Remarks..."
                                    className="h-9"
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

      {/* Submit Button */}
      <div className="flex justify-end border-t pt-4 max-md:border-0 max-md:pt-2">
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending}
          className="min-w-[120px] max-md:h-12 max-md:w-full max-md:rounded-xl max-md:bg-[#635BFF] max-md:text-base max-md:font-semibold hover:max-md:bg-[#5248e6]"
        >
          {submitMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Check className="mr-2 h-5 w-5 max-md:inline md:hidden" />
              <span className="md:hidden">SUBMIT ASSESSMENT</span>
              <span className="hidden md:inline">SUBMIT</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );

  if (asPage) {
    return (
      <div className="max-md:-mx-3 max-md:px-3 sm:max-md:-mx-4 sm:max-md:px-4 max-md:bg-[#F7F6F2] max-md:pb-8 max-md:pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1 max-md:mb-1"
          onClick={() => router.push(redirectPath)}
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Assessment List
        </Button>
        <div className="rounded-lg border bg-card p-4 md:p-6 max-md:border-0 max-md:bg-transparent max-md:p-0">
          {formContent}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose ?? (() => { })}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto max-md:bg-[#F7F6F2]">
        <DialogHeader>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
};

export default AssessmentForm;

