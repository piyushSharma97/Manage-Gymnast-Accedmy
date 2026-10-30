'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

const schema = z.object({
  fitnessSkillId: z.number().min(1).optional(),
  level: z.string().min(1, 'Level is required').max(200, 'Max 200 characters'),
  description: z.string().max(300).optional().nullable(),
  targetValue: z.string().max(200).optional().nullable(),
});

type FormValues = z.infer<typeof schema>;

type Criterion = {
  id: number;
  fitnessSkillId: number;
  level: string;
  description: string | null;
  targetValue: string | null;
};

type SkillOption = { id: number; name: string; unitOfMeasurement: string; fitnessCategory?: { name: string } };

type Props = {
  open: boolean;
  closeDialog: () => void;
  criterion: Criterion | null;
  fitnessSkillId: number;
  skillName?: string;
  skillsForAdd?: SkillOption[];
  queryKey: string;
};

export default function GradingCriteriaEditDialog({
  open,
  closeDialog,
  criterion,
  fitnessSkillId,
  skillName,
  skillsForAdd,
  queryKey,
}: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!criterion?.id;
  const [skillComboboxOpen, setSkillComboboxOpen] = useState(false);

  const { data: levelsData = [] } = useQuery({
    queryKey: ['skill-level-select'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.skillLevel.select);
      if (!res.ok) throw new Error('Failed to fetch levels');
      return res.json();
    },
    enabled: open,
  });
  const levelOptions = levelsData as Array<{ id: string; levelName: string; numericId?: number }>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fitnessSkillId: 0, level: '', description: '', targetValue: '' },
  });

  useEffect(() => {
    if (open) {
      if (criterion) {
        form.reset({
          fitnessSkillId: criterion.fitnessSkillId,
          level: criterion.level,
          description: criterion.description ?? '',
          targetValue: criterion.targetValue ?? '',
        });
      } else {
        form.reset({
          fitnessSkillId: skillsForAdd?.[0]?.id ?? 0,
          level: '',
          description: '',
          targetValue: '',
        });
      }
    }
  }, [open, criterion, form, skillsForAdd]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const url = isEdit
        ? API_PATHS.administration.fitnessGradingCriteria.byId(String(criterion!.id))
        : API_PATHS.administration.fitnessGradingCriteria.list;
      const skillId = isEdit ? criterion!.fitnessSkillId : (values.fitnessSkillId ?? fitnessSkillId);
      const res = await apiFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                level: values.level,
                description: values.description || null,
                targetValue: values.targetValue || null,
              }
            : {
                fitnessSkillId: skillId,
                level: values.level,
                description: values.description || null,
                targetValue: values.targetValue || null,
              }
        ),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(criterion ? 'Criterion updated' : 'Criterion added');
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {criterion ? 'Edit grading criterion' : 'Add grading criterion'}
            {skillName && (
              <span className="text-muted-foreground font-normal text-sm block mt-1">{skillName}</span>
            )}
          </DialogTitle>
        </DialogHeader>
        {!isEdit && (!skillsForAdd || skillsForAdd.length === 0) ? (
          <p className="text-sm text-muted-foreground py-4">
            No fitness skills available. Add skills under Fitness Skills first.
          </p>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            {!isEdit && skillsForAdd && skillsForAdd.length > 0 && (
              <FormField
                control={form.control}
                name="fitnessSkillId"
                render={({ field }) => {
                  const selectedSkill = skillsForAdd.find((s) => s.id === field.value);
                  const displayValue = selectedSkill
                    ? `${selectedSkill.name} (${selectedSkill.unitOfMeasurement})${selectedSkill.fitnessCategory?.name ? ` · ${selectedSkill.fitnessCategory.name}` : ''}`
                    : '';
                  return (
                    <FormItem>
                      <FormLabel>Skill</FormLabel>
                      <Popover open={skillComboboxOpen} onOpenChange={setSkillComboboxOpen}>
                        <FormControl>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={skillComboboxOpen}
                              className="w-full justify-between font-normal"
                            >
                              <span className={cn(!field.value && 'text-muted-foreground')}>
                                {displayValue || 'Select skill...'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                        </FormControl>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search skills..." />
                            <CommandList>
                              <CommandEmpty>No skill found.</CommandEmpty>
                              <CommandGroup>
                                {skillsForAdd.map((s) => {
                                  const label = `${s.name} (${s.unitOfMeasurement})${s.fitnessCategory?.name ? ` · ${s.fitnessCategory.name}` : ''}`;
                                  return (
                                    <CommandItem
                                      key={s.id}
                                      value={label}
                                      onSelect={() => {
                                        field.onChange(s.id);
                                        setSkillComboboxOpen(false);
                                      }}
                                    >
                                      <CommandCheck icon={Check} className={field.value === s.id ? 'opacity-100' : 'opacity-0'} />
                                      {label}
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}
            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level</FormLabel>
                  {levelOptions.length > 0 ? (
                    <Select
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {levelOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.levelName ?? opt.id}>
                            {opt.levelName ?? opt.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input placeholder="e.g. L1A, L2" {...field} value={field.value ?? ''} />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g. Minimum standard for this level"
                      {...field}
                      value={field.value ?? ''}
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target value (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 10 reps, 30 sec" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {criterion ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
