'use client';

import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';

type Student = {
  id?: string;
  registrationNo?: string;
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string;
  status?: string;
  joinDate?: string | null;
};

const StudentSchema = z.object({
  registrationNo: z.string().min(1).max(100),
  firstName: z.string().min(1).max(100),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().max(20).optional(),
  gender: z.enum(['Male', 'Female']),
  locationId: z.number(),
  team: z.string().optional(),
  sportCategoryId: z.string().optional(),
  currentSkillLevelId: z.string().optional(),
  Board: z.enum(['CBSE', 'ICSE', 'IB', 'State']).optional(),
  profilePhotoUrl: z.string().optional(),
  joinDate: z.string().optional(),
});

export type StudentSchemaType = z.infer<typeof StudentSchema>;

export interface StudentEditDialogProps {
  open: boolean;
  closeDialog: () => void;
  student: Student | null;
}

const StudentEditDialog = ({ open, closeDialog, student }: StudentEditDialogProps) => {
  const form = useForm<StudentSchemaType>({
    resolver: zodResolver(StudentSchema),
    defaultValues: {
      registrationNo: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: 'Male',
    },
  });

  useEffect(() => {
    if (open) {
      if (student) {
        form.reset({
          registrationNo: student.registrationNo || '',
          firstName: student.firstName || '',
          lastName: student.lastName || '',
          email: student.email || '',
          phone: student.phone || '',
          gender: (student.gender as any) || 'Male',
        });
      } else {
        form.reset({
          registrationNo: '',
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          gender: 'Male',
        });
      }
    }
  }, [form, open, student]);

  const mutation = useMutation({
    mutationFn: async (values: StudentSchemaType) => {
      const isEdit = !!student?.id;
      const url = isEdit ? `/api/manager/students/${student?.id}` : '/api/manager/students';
      const method = isEdit ? 'PUT' : 'POST';
      const response = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const { message } = await response.json();
        throw new Error(message);
      }
      return response.json();
    },
    onSuccess: () => {
      const isEdit = !!student?.id;
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>{isEdit ? 'Student updated successfully' : 'Student added successfully'}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
      closeDialog();
    },
    onError: (error: Error) => {
      toast.custom(
        () => (
          <Alert variant="mono" icon="destructive">
            <AlertIcon>
              <RiErrorWarningFill />
            </AlertIcon>
            <AlertTitle>{error.message}</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
    },
  });

  const onSubmit = (values: StudentSchemaType) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{student ? 'Edit Student' : 'Add Student'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((data) => onSubmit(data as StudentSchemaType))}
          className="grid grid-cols-2 gap-4"
        >
          <div>
            <Label>Registration No</Label>
            <Input {...form.register('registrationNo')} />
          </div>
          <div>
            <Label>First Name</Label>
            <Input {...form.register('firstName')} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input {...form.register('lastName')} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" {...form.register('email')} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input {...form.register('phone')} />
          </div>
          <div>
            <Label>Gender</Label>
            <Select
              value={form.watch('gender')}
              onValueChange={(val) => form.setValue('gender', val as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* <div>
            <Label>Location</Label>
            <LocationSelect onChange={(id) => form.setValue('locationId', id)} value={form.watch('locationId')} />
          </div> */}
          <div>
            <Label>Team</Label>
            <TeamSelect onChange={(val) => form.setValue('team', val)} value={form.watch('team') || ''} />
          </div>
          <div>
            <Label>Sports Category</Label>
            <SportsCategorySelect onChange={(val) => form.setValue('sportCategoryId', val)} value={form.watch('sportCategoryId') || ''} />
          </div>
          <div>
            <Label>Skill Level</Label>
            <SkillLevelSelect onChange={(val) => form.setValue('currentSkillLevelId', val)} value={form.watch('currentSkillLevelId') || ''} />
          </div>
          <div>
            <Label>Board</Label>
            <Select
              value={form.watch('Board') || ''}
              onValueChange={(val) => form.setValue('Board', val as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CBSE">CBSE</SelectItem>
                <SelectItem value="ICSE">ICSE</SelectItem>
                <SelectItem value="IB">IB</SelectItem>
                <SelectItem value="State">State</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Profile Photo URL</Label>
            <Input placeholder="/media/avatars/your-file.png" {...form.register('profilePhotoUrl')} />
          </div>

          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.status === 'pending'}>
              {student ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StudentEditDialog;

// Auxiliary select components
import { useState } from 'react';
import { useEffect as useEffect2 } from 'react';

// function LocationSelect({ value, onChange }: { value?: number; onChange: (id: number) => void }) {
//   const [options, setOptions] = useState<{ id: number; centerName: string }[]>([]);
//   useEffect2(() => {
//     apiFetch('/api/location/select').then(async (res) => {
//       const data = await res.json();
//       setOptions(data);
//     });
//   }, []);
//   return (
//     <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
//       <SelectTrigger>
//         <SelectValue placeholder="Select Location" />
//       </SelectTrigger>
//       <SelectContent>
//         {options.map((o) => (
//           <SelectItem key={o.id} value={String(o.id)}>
//             {o.centerName}
//           </SelectItem>
//         ))}
//       </SelectContent>
//     </Select>
//   );
// }

function TeamSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [options, setOptions] = useState<{ id: number; name: string }[]>([]);
  useEffect2(() => {
    apiFetch('/api/team/select').then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);
  return (
    <Select value={value} onValueChange={(v) => onChange(v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select Team" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SportsCategorySelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [options, setOptions] = useState<{ id: number; categoryName: string }[]>([]);
  useEffect2(() => {
    const url = new URL('/api/administration/sports-categories', window.location.origin);
    url.searchParams.set('page', '1');
    url.searchParams.set('limit', '100');
    apiFetch(url.toString()).then(async (res) => {
      const data = await res.json();
      setOptions(data.data || []);
    });
  }, []);
  return (
    <Select value={value} onValueChange={(v) => onChange(v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select Sport Category" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.categoryName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SkillLevelSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [options, setOptions] = useState<{ levelName: string }[]>([]);
  useEffect2(() => {
    apiFetch('/api/administration/skilllevel/select').then(async (res) => {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setOptions(arr.map((r: any) => ({ levelName: r.levelName })));
    }).catch(() => setOptions([]));
  }, []);
  return (
    <Select value={value} onValueChange={(v) => onChange(v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select Skill Level" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.levelName} value={o.levelName}>
            {o.levelName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


