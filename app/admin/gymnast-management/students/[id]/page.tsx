'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm ,Controller} from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { RiCheckboxCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { Container } from '@/components/common/container';

import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
  ToolbarTitle,
} from '@/components/common/toolbar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { PhotoUpload } from '../components/photo-upload';
import type { StudentGuardianWithRelation } from '@/types/domain';

const StudentSchema = z.object({
  firstName: z.string().min(1,'First name is required').max(100, 'First name must be 100 characters or less'),
  lastName: z.string().optional(),
  email: z.string().min(1, 'Email is required').max(100, 'Email must be 100 characters or less').email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required').max(10, 'Phone number must be 10 digits or less').regex(/^\d+$/, 'Phone number must contain only digits'),
  gender: z.enum(['Male', 'Female']),
  locationId: z.number(),
  team: z.string().optional(),
  currentSkillLevelId: z.string().min(1, 'Skill level is required'),
  Board: z.enum(['CBSE', 'ICSE', 'IB', 'State']).optional(),
  schoolName: z.string().max(100).optional().or(z.literal('').transform(() => undefined)),
  gradeClass: z.string().max(20).optional().or(z.literal('').transform(() => undefined)),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  profilePhotoUrl: z.string().optional(),
  joinDate: z.string().optional(),
  dob: z.string().optional(),
  // Guardian fields
  guardianFirstName: z.string().min(1, 'Parent first name is required').max(100),
  guardianLastName: z.string().min(1, 'Parent last name is required').max(100),
});

export type StudentSchemaType = z.infer<typeof StudentSchema>;

function LocationSelect({ value, onChange }: { value?: number; onChange: (id: number) => void }) {
  const [options, setOptions] = useState<{ id: number; centerName: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    apiFetch(API_PATHS.location.select).then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);

  // Sync selected value when props or options change
  useEffect(() => {
    if (value == null || options.length === 0) {
      setSelectedValue(undefined);
      return;
    }

    // Check if provided value matches an existing option
    const match = options.find((o) => o.id === value);
    if (match) {
      setSelectedValue(String(match.id));
    } else {
      setSelectedValue(undefined);
    }
  }, [value, options]);

  return (
    <Select value={selectedValue} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger>
        <SelectValue placeholder="Select Location" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={String(o.id)}>
            {o.centerName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}


function TeamSelect({ value, onChange }: { value?: string; onChange: (val: string) => void }) {
  const [options, setOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    apiFetch(API_PATHS.team.select).then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);

  // Convert team name to ID when options are loaded
  useEffect(() => {
    if (!value || options.length === 0) {
      setSelectedValue(undefined);
      return;
    }

    // Check if value is already an ID (numeric string)
    if (/^\d+$/.test(value)) {
      setSelectedValue(value);
      return;
    }

    // Otherwise, it's a team name - find the matching ID
    const team = options.find((o) => o.name === value);
    if (team) {
      setSelectedValue(String(team.id));
    } else {
      setSelectedValue(undefined);
    }
  }, [value, options]);

  return (
    <Select value={selectedValue} onValueChange={(v) => onChange(v)}>
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

function SkillLevelSelect({ value, onChange }: { value?: string; onChange: (val: string) => void }) {
  const [options, setOptions] = useState<{ id: string; levelName: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | undefined>(undefined);

  useEffect(() => {
    apiFetch(API_PATHS.skillLevel.select).then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);

  // Update selected value when value or options change (value may be levelCode/id or levelName from DB)
  useEffect(() => {
    if (!value || options.length === 0) {
      setSelectedValue(undefined);
      return;
    }

    const skillLevel = options.find((o) => o.id === value || o.levelName === value);
    if (skillLevel) {
      setSelectedValue(skillLevel.id);
    } else {
      setSelectedValue(undefined);
    }
  }, [value, options]);

  return (
    <Select value={selectedValue} onValueChange={(v) => onChange(v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select Skill Level" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.levelName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GenderSelect({
  value,
  onChange,
}: {
  value?: 'Male' | 'Female';
  onChange: (val: 'Male' | 'Female') => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as 'Male' | 'Female')}>
      <SelectTrigger>
        <SelectValue placeholder="Select Gender" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="Male">Male</SelectItem>
        <SelectItem value="Female">Female</SelectItem>
      </SelectContent>
    </Select>
  );
}


export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const studentId = params.id as string;
const [ready, setReady] = useState(false);
  const { data: student, isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.student.byId(studentId));
      if (!response.ok) {
        throw new Error('Failed to fetch student');
      }
      return response.json();
    },
    enabled: !!studentId,
  });

  // Guardian information is now included in the student data from the API

  const form = useForm<StudentSchemaType>({
    resolver: zodResolver(StudentSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      gender: 'Male' as const,
      locationId: 0,
      team: '',
      currentSkillLevelId: '',
      Board: undefined,
      schoolName: '',
      gradeClass: '',
      bloodGroup: undefined,
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      profilePhotoUrl: '',
      joinDate: '',
      dob: '',
      guardianFirstName: '',
      guardianLastName: '',
    },
  });

  useEffect(() => {
    if (student) {
      console.log('Raw student.gender:', student.gender);
      console.log('Type of student.gender:', typeof student.gender);
      console.log('Full student object:', student);
      const primaryGuardian = student.studentguardians?.find((g: StudentGuardianWithRelation) => g.isPrimary) || student.studentguardians?.[0];
      const guardianAddress = primaryGuardian?.guardian?.address || {};
      const genderValue: 'Male' | 'Female' =
        (student.gender === 'Male' || student.gender === 'Female')
          ? student.gender
          : 'Male';

      // Format joinDate if it exists
      let formattedJoinDate = '';
      if (student.joinDate) {
        const joinDateObj = typeof student.joinDate === 'string' ? new Date(student.joinDate) : student.joinDate;
        if (joinDateObj && !isNaN(joinDateObj.getTime())) {
          formattedJoinDate = joinDateObj.toISOString().split('T')[0];
        }
      }

      // Format dob if it exists
      let formattedDob = '';
      if (student.dob) {
        const dobObj = typeof student.dob === 'string' ? new Date(student.dob) : student.dob;
        if (dobObj && !isNaN(dobObj.getTime())) {
          formattedDob = dobObj.toISOString().split('T')[0];
        }
      }

      // Get blood group value - ensure it's a valid enum value
      const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
      const bloodGroupValue = (student.bloodGroup && validBloodGroups.includes(student.bloodGroup))
        ? student.bloodGroup
        : undefined;

      // Get Board value - ensure it's a valid enum value
      const validBoards = ['CBSE', 'ICSE', 'IB', 'State'];
      const boardValue = (student.Board && validBoards.includes(student.Board))
        ? (student.Board as 'CBSE' | 'ICSE' | 'IB' | 'State')
        : undefined;

      // Team: keep as is (will be handled by TeamSelect component to convert name to ID)
      // If team is stored as name, TeamSelect will find the matching ID
      const teamValue = student.team ? String(student.team) : '';

      // Skill level: DB stores skilllevelName (levelCode from select); select options use id=levelCode
      const skillLevelValue = (student as { skilllevelName?: string | null }).skilllevelName
        ? String((student as { skilllevelName?: string | null }).skilllevelName).trim()
        : '';

      // Location ID - ensure it's a number, use 0 as fallback but prefer actual locationId
      const locationIdValue = student.locationId
        ? student.locationId
        : (student.location?.id)
          ? student.location.id
          : 0;

      const formValues = {
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        email: student.email || '',
        phone: student.phone || '',
        gender: genderValue,
        locationId: locationIdValue,
        team: teamValue,
        currentSkillLevelId: skillLevelValue,
        Board: boardValue,
        schoolName: student.schoolName || '',
        gradeClass: student.gradeClass || '',
        bloodGroup: bloodGroupValue,
        addressLine1: student.addressLine1 || guardianAddress.addressLine1 || '',
        addressLine2: student.addressLine2 || guardianAddress.addressLine2 || '',
        city: student.city || guardianAddress.city || '',
        state: student.state || guardianAddress.state || '',
        postalCode: student.postalCode || guardianAddress.postalCode || '',
        profilePhotoUrl: student.profilePhotoUrl || '',
        joinDate: formattedJoinDate,
        dob: formattedDob,
        guardianFirstName: primaryGuardian?.guardian?.firstName || '',
        guardianLastName: primaryGuardian?.guardian?.lastName || '',
      };
  if (student) {
      form.reset(formValues);
      console.log('Final genderValue being set:', genderValue);
        setReady(true);
  }
    }
  }, [student, form]);

  const mutation = useMutation({
    mutationFn: async (values: StudentSchemaType) => {
      const response = await apiFetch(API_PATHS.student.byId(studentId), {
        method: 'PUT',
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
      toast.custom(
        () => (
          <Alert variant="mono" icon="success">
            <AlertIcon>
              <RiCheckboxCircleFill />
            </AlertIcon>
            <AlertTitle>Student updated successfully</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
      queryClient.invalidateQueries({ queryKey: ['student', studentId] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      router.push('/admin/gymnast-management/students');
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

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <p>Loading...</p>
        </div>
      </Container>
    );
  }

  if (!student) {
    return (
      <Container>
        <div className="flex items-center justify-center py-12">
          <p>Student not found</p>
        </div>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarTitle>Edit Student</ToolbarTitle>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin/gymnast-management/students">Students</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Edit Student</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </ToolbarHeading>
          <ToolbarActions>
            <Button variant="outline" asChild>
              <Link href="/admin/gymnast-management/students">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Link>
            </Button>
          </ToolbarActions>
        </Toolbar>
      </Container>
      <Container>
        <Card>
          <CardHeader>
            <CardTitle>Student Information</CardTitle>
            <CardDescription>Update the student details below</CardDescription>
          </CardHeader>
          <CardContent>
            {ready && (
            <form key={student?.id || 'new'} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input {...form.register('firstName')} />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input {...form.register('lastName')} />
                </div>
                <div>
                  <Label>Gender *</Label>
                  <GenderSelect
                    value={form.watch('gender')}
                    onChange={(val) => form.setValue('gender', val, { shouldDirty: true })}
                  />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    {...form.register('dob')}
                    value={form.watch('dob') || ''}
                    onChange={(e) => form.setValue('dob', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Blood Group</Label>
                  <Select
                    value={form.watch('bloodGroup') || undefined}
                    onValueChange={(val) => form.setValue('bloodGroup', val ? (val as StudentSchemaType['bloodGroup']) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Blood Group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A+">A+</SelectItem>
                      <SelectItem value="A-">A−</SelectItem>
                      <SelectItem value="B+">B+</SelectItem>
                      <SelectItem value="B-">B−</SelectItem>
                      <SelectItem value="AB+">AB+</SelectItem>
                      <SelectItem value="AB-">AB−</SelectItem>
                      <SelectItem value="O+">O+</SelectItem>
                      <SelectItem value="O-">O−</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>School Name</Label>
                  <Input {...form.register('schoolName')} />
                </div>
                <div>
                  <Label>Grade/Class</Label>
                  <Input {...form.register('gradeClass')} />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" {...form.register('email')} maxLength={100} />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input
                    type="tel"
                    maxLength={10}
                    {...form.register('phone')}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      form.setValue('phone', value);
                    }}
                  />
                  {form.formState.errors.phone && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.phone.message}</p>
                  )}
                </div>
                <div>
                  <Label>Location *</Label>
                  <LocationSelect onChange={(id) => form.setValue('locationId', id)} value={form.watch('locationId')} />
                  {form.formState.errors.locationId && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.locationId.message}</p>
                  )}
                </div>
                <div>
                  <Label>Team</Label>
                  <TeamSelect onChange={(val) => form.setValue('team', val)} value={form.watch('team')} />
                </div>
                <div>
                  <Label>Skill Level *</Label>
                  <SkillLevelSelect onChange={(val) => form.setValue('currentSkillLevelId', val)} value={form.watch('currentSkillLevelId')} />
                  {form.formState.errors.currentSkillLevelId && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.currentSkillLevelId.message}</p>
                  )}
                </div>
                <div>
                  <Label>Board</Label>
                  <Select
                    value={form.watch('Board') || undefined}
                    onValueChange={(val) => form.setValue('Board', val ? (val as StudentSchemaType['Board']) : undefined)}
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
              </div>

              <div className="border-t pt-6">
                <PhotoUpload
                  value={form.watch('profilePhotoUrl')}
                  onChange={(url) => form.setValue('profilePhotoUrl', url)}
                  label="Profile Photo"
                />
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Address Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Address Line 1</Label>
                    <Input {...form.register('addressLine1')} />
                  </div>
                  <div>
                    <Label>Address Line 2</Label>
                    <Input {...form.register('addressLine2')} />
                  </div>
                  <div>
                    <Label>City</Label>
                    <Input {...form.register('city')} />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input {...form.register('state')} />
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input {...form.register('postalCode')} />
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-semibold mb-4">Parent Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Parent First Name *</Label>
                    <Input {...form.register('guardianFirstName')} maxLength={100} />
                    {form.formState.errors.guardianFirstName && (
                      <p className="text-sm text-destructive mt-1">{form.formState.errors.guardianFirstName.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Parent Last Name *</Label>
                    <Input {...form.register('guardianLastName')} maxLength={100} />
                    {form.formState.errors.guardianLastName && (
                      <p className="text-sm text-destructive mt-1">{form.formState.errors.guardianLastName.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin/gymnast-management/students">Cancel</Link>
                </Button>
                <Button type="submit" disabled={mutation.status === 'pending'}>
                  {mutation.status === 'pending' ? 'Updating...' : 'Update Student'}
                </Button>
              </div>
            </form>
            )}
          </CardContent>
        </Card>
      </Container >
    </>
  );
}

