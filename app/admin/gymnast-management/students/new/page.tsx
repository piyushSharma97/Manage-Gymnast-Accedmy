'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
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
import { useState, useEffect, Suspense } from 'react';
import { PhotoUpload } from '../components/photo-upload';

// List of all Indian states
const INDIAN_STATES = [
	'Andhra Pradesh',
	'Arunachal Pradesh',
	'Assam',
	'Bihar',
	'Chhattisgarh',
	'Goa',
	'Gujarat',
	'Haryana',
	'Himachal Pradesh',
	'Jharkhand',
	'Karnataka',
	'Kerala',
	'Madhya Pradesh',
	'Maharashtra',
	'Manipur',
	'Meghalaya',
	'Mizoram',
	'Nagaland',
	'Odisha',
	'Punjab',
	'Rajasthan',
	'Sikkim',
	'Tamil Nadu',
	'Telangana',
	'Tripura',
	'Uttar Pradesh',
	'Uttarakhand',
	'West Bengal',
	'Andaman and Nicobar Islands',
	'Chandigarh',
	'Dadra and Nagar Haveli and Daman and Diu',
	'Delhi',
	'Jammu and Kashmir',
	'Ladakh',
	'Lakshadweep',
	'Puducherry',
];

const StudentSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name must be 100 characters or less'),
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
  bloodGroup: z.enum(['A+','A-','B+','B-','AB+','AB-','O+','O-']).optional(),
  profilePhotoUrl: z.string().optional(),
  joinDate: z.string().optional(),
  dob: z.string().optional(),
  // Address fields (country removed; API defaults to India)
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  // Guardian fields
  guardianFirstName: z.string().min(1, 'Parent First name is required').max(100),
  guardianLastName: z.string().min(1, 'Parent Last name is required').max(100),
  // Trial ID for updating isRegistered status
  trialId: z.string().optional(),
});

export type StudentSchemaType = z.infer<typeof StudentSchema>;

function LocationSelect({ value, onChange }: { value?: number; onChange: (id: number) => void }) {
  const [options, setOptions] = useState<{ id: number; centerName: string }[]>([]);
  useEffect(() => {
    apiFetch(API_PATHS.location.select).then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);
  return (
    <Select value={value ? String(value) : ''} onValueChange={(v) => onChange(Number(v))}>
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

function TeamSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [options, setOptions] = useState<{ id: number; name: string }[]>([]);
  useEffect(() => {
    apiFetch(API_PATHS.team.select).then(async (res) => {
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
  useEffect(() => {
    apiFetch(withParams(API_PATHS.administration.sportsCategories.list, 'page=1&limit=100')).then(async (res) => {
      const data = await res.json();
      const categories = data.data || [];
      setOptions(categories);
      // Default to gymnastics if no value is set
      if (!value) {
        const gymnasticsCategory = categories.find(
          (cat: { categoryName: string }) => cat.categoryName.toLowerCase() === 'gymnastics'
        );
        if (gymnasticsCategory) {
          onChange(String(gymnasticsCategory.id));
        }
      }
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
  const [options, setOptions] = useState<{ id: string; levelName: string }[]>([]);
  useEffect(() => {
    apiFetch(API_PATHS.skillLevel.select).then(async (res) => {
      const data = await res.json();
      setOptions(data);
    });
  }, []);
  return (
    <Select value={value} onValueChange={(v) => onChange(v)}>
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

function NewStudentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trialPrefillLoaded, setTrialPrefillLoaded] = useState(false);
  
  // Get trial data from URL params
  const trialId = searchParams.get('trialId');
  const trialFirstName = searchParams.get('firstName');
  const trialEmail = searchParams.get('email');
  const trialPhone = searchParams.get('phone');
  const trialGuardianFirstName = searchParams.get('guardianFirstName');
  const trialGuardianLastName = searchParams.get('guardianLastName');
  
  // Split firstName into first and last name if it has 2 parts
  let firstName = trialFirstName || '';
  let lastName = '';
  if (trialFirstName) {
    const nameParts = trialFirstName.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    } else {
      firstName = trialFirstName;
    }
  }
  
  const form = useForm<StudentSchemaType>({
    resolver: zodResolver(StudentSchema),
    defaultValues: {
      firstName: firstName,
      lastName: lastName,
      email: trialEmail || '',
      phone: trialPhone || '',
      gender: 'Male' as const,
      guardianFirstName: trialGuardianFirstName || '',
      guardianLastName: trialGuardianLastName || '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
    },
  });

  useEffect(() => {
    if (!trialId || trialPrefillLoaded) return;

    let isCancelled = false;

    const fetchTrialDetails = async () => {
      try {
        const response = await apiFetch(API_PATHS.trial.byId(trialId));
        if (!response.ok) {
          return;
        }

        const trialData = await response.json();
        if (isCancelled || !trialData) return;

        const normalizedGender: StudentSchemaType['gender'] =
          trialData.gender === 'Female' ? 'Female' : 'Male';
        form.setValue('gender', normalizedGender);
      } catch (error) {
        console.error('Failed to prefill trial data', error);
      } finally {
        if (!isCancelled) {
          setTrialPrefillLoaded(true);
        }
      }
    };

    fetchTrialDetails();

    return () => {
      isCancelled = true;
    };
  }, [trialId, form, trialPrefillLoaded]);

  const mutation = useMutation({
    mutationFn: async (values: StudentSchemaType) => {
      // Include trialId if it exists in URL params
      const payload = trialId ? { ...values, trialId } : values;
      const response = await apiFetch(API_PATHS.student.list, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
            <AlertTitle>Student added successfully</AlertTitle>
          </Alert>
        ),
        { position: 'top-center' },
      );
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

  return (
    <>
      <Container>
        <Toolbar>
          <ToolbarHeading>
            <ToolbarTitle>Add Student</ToolbarTitle>
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
                  <BreadcrumbPage>Add Student</BreadcrumbPage>
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
            <CardDescription>Enter the student details below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>First Name *</Label>
                  <Input {...form.register('firstName')} maxLength={100} />
                  {form.formState.errors.firstName && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input {...form.register('lastName')} maxLength={100} />
                </div>
                <div>
                  <Label>Gender *</Label>
                  <Select
                    value={form.watch('gender')}
                    onValueChange={(val) => form.setValue('gender', val as 'Male' | 'Female')}
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
                    value={form.watch('bloodGroup') || ''}
                    onValueChange={(val) => form.setValue('bloodGroup', val as 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | undefined)}
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
                  <Input {...form.register('schoolName')} maxLength={100} />
                </div>
                <div>
                  <Label>Board</Label>
                  <Select
                    value={form.watch('Board') || ''}
                    onValueChange={(val) => form.setValue('Board', val as 'CBSE' | 'ICSE' | 'IB' | 'State' | undefined)}
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
                  <TeamSelect onChange={(val) => form.setValue('team', val)} value={form.watch('team') || ''} />
                </div>
                <div>
                  <Label>Skill Level *</Label>
                  <SkillLevelSelect onChange={(val) => form.setValue('currentSkillLevelId', val)} value={form.watch('currentSkillLevelId') || ''} />
                  {form.formState.errors.currentSkillLevelId && (
                    <p className="text-sm text-destructive mt-1">{form.formState.errors.currentSkillLevelId.message}</p>
                  )}
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
                    <Select
                      value={form.watch('state') || ''}
                      onValueChange={(val) => form.setValue('state', val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Postal Code</Label>
                    <Input {...form.register('postalCode')} />
                  </div>
                  {/* Country removed; API defaults to India */}
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
                  {mutation.status === 'pending' ? 'Creating...' : 'Create Student'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}

export default function NewStudentPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewStudentForm />
    </Suspense>
  );
}

