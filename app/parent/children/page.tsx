'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { useParentSelectedStudent } from '@/components/providers/parent-selected-student-provider';
import { Container } from '@/components/common/container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User } from 'lucide-react';

type Child = { id: string; name: string; level: string | null; registrationNo?: string };

export default function ParentChildrenPage() {
  const router = useRouter();
  const { setSelectedStudentId } = useParentSelectedStudent();
  const { data, isLoading, error } = useQuery({
    queryKey: ['parent-children'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.parent.children);
      if (!res.ok) throw new Error('Failed to fetch children');
      return res.json();
    },
  });

  const children = (data?.data ?? []) as Child[];

  const handleSelect = (childId: string) => {
    setSelectedStudentId(childId);
    router.push('/parent/dashboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || children.length === 0) {
    return (
      <Container width="fluid" className="py-12">
        <div className="max-w-md mx-auto text-center">
          <p className="text-muted-foreground">
            {children.length === 0
              ? 'No children linked to your account.'
              : 'Unable to load children. Please try again.'}
          </p>
        </div>
      </Container>
    );
  }

  return (
    <Container width="fluid" className="py-8 sm:py-12">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-center mb-2">
          Select a child
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          Choose whose progress you want to view
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => (
            <Card
              key={child.id}
              className="cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary"
              tabIndex={0}
              onClick={() => handleSelect(child.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelect(child.id);
                }
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <User className="size-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">{child.name}</CardTitle>
                    {child.level && (
                      <p className="text-sm text-muted-foreground">{child.level}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View dashboard &rarr;
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Container>
  );
}

