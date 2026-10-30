'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { Pencil, Search, X, Calendar, Eye, ChevronsUpDown, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import FitnessAssessmentForm from './fitness-assessment-form';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FitnessAssessmentResults from './fitness-assessment-results';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
  CardToolbar,
} from '@/components/ui/card';
import {
  DataGrid,
  DataGridApiFetchParams,
  DataGridApiResponse,
} from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import FitnessAssessmentCommentDialog from './fitness-assessment-comment-dialog';

type AssessmentRecord = {
  id: string;
  studentId: string;
  name: string;
  dob: string | null;
  age: number | null;
  gender: string;
  phone: string | null;
  email: string | null;
  group: string | null;
  level: string | null;
  height: number | null;
  weight: number | null;
  comments: string | null;
  result: string | null;
  eventId: number;
  eventName: string;
  eventDate?: string | Date | null;
  registrationNo: string;
};

type EventType = { id: number; name: string; event_type?: string };

const FitnessAssessmentList = () => {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const basePath = pathname?.startsWith('/coach')
    ? '/coach/fitness-assessment/assessment'
    : pathname?.startsWith('/manager')
      ? '/manager/fitness-assessment/assessment'
      : '/admin/fitness-assessment/assessment';

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [fitnessSkillFilter, setFitnessSkillFilter] = useState<string>('all');
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [selectedStudentForResults, setSelectedStudentForResults] = useState<{
    id: string;
    name: string;
    eventId?: number;
  } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
    eventId?: number;
  } | null>(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedStudentForComment, setSelectedStudentForComment] = useState<{
    studentId: string;
    name: string;
    eventId: number;
    eventName: string;
    eventDate?: string | Date | null;
  } | null>(null);

  const { data: eventsData } = useQuery({
    queryKey: ['fitness-assessment-events-select'],
    queryFn: async () => {
      const url = withParams(API_PATHS.eventManagement.events.select, 'eventType=fitness-assessment');
      const response = await apiFetch(url);
      if (!response.ok) throw new Error('Failed to fetch events');
      return response.json();
    },
  });

  const { data: fitnessSkillsData } = useQuery({
    queryKey: ['fitness-assessment-skills-filter'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.fitnessAssessment.skills);
      if (!response.ok) throw new Error('Failed to fetch fitness skills');
      return response.json();
    },
  });

  const levelGroups = fitnessSkillsData?.data ?? [];
  const fitnessSkillsList = useMemo(
    () =>
      levelGroups.flatMap(
        (g: { skills?: { id: number; name: string; level: string }[] }) => g.skills || []
      ),
    [levelGroups]
  );

  const { data: levelsList } = useQuery({
    queryKey: ['skill-levels-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.skillLevel.select);
      if (!response.ok) throw new Error('Failed to fetch levels');
      return response.json();
    },
  });

  const fetchAssessmentData = async ({
    pageIndex,
    pageSize,
    sorting,
    searchQuery,
  }: DataGridApiFetchParams): Promise<DataGridApiResponse<AssessmentRecord>> => {
    const sortField = sorting?.[0]?.id || 'name';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';
    const params = new URLSearchParams({
      page: String((pageIndex ?? 0) + 1),
      limit: String(pageSize),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(eventFilter !== 'all' ? { eventId: eventFilter } : {}),
      ...(levelFilter !== 'all' ? { level: levelFilter } : {}),
      ...(fitnessSkillFilter !== 'all' ? { fitnessSkillId: fitnessSkillFilter } : {}),
    });
    const response = await apiFetch(
      withParams(API_PATHS.fitnessAssessment.assessment.list, params)
    );
    if (!response.ok) throw new Error('Failed to load fitness assessment list');
    return response.json();
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      'fitness-assessment',
      pagination,
      sorting,
      searchQuery,
      eventFilter,
      levelFilter,
      fitnessSkillFilter,
    ],
    queryFn: () =>
      fetchAssessmentData({
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting,
        searchQuery,
      }),
  });

  const { data: assessmentResults, isLoading: isLoadingResults } = useQuery({
    queryKey: [
      'fitness-assessment-result',
      selectedStudentForResults?.id,
      selectedStudentForResults?.eventId,
    ],
    queryFn: async () => {
      if (!selectedStudentForResults?.id || !selectedStudentForResults?.eventId) return null;
      const response = await apiFetch(
        withParams(
          API_PATHS.fitnessAssessment.assessment.result,
          `studentId=${selectedStudentForResults.id}&eventId=${selectedStudentForResults.eventId}`
        )
      );
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedStudentForResults?.id && !!selectedStudentForResults?.eventId,
  });

  const columns: ColumnDef<AssessmentRecord>[] = useMemo(
    () => [
      {
        id: 'edit',
        header: '',
        cell: ({ row }) => {
          const record = row.original;
          return (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild title="Do Assessment">
              <Link
                href={`${basePath}/do/${record.studentId}/${record.eventId}?studentName=${encodeURIComponent(record.name)}`}
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </Button>
          );
        },
        enableSorting: false,
        size: 50,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Name" />,
        cell: ({ row }) => <span>{row.original.name}</span>,
      },
      {
        accessorKey: 'dob',
        header: ({ column }) => <DataGridColumnHeader column={column} title="DOB" />,
        cell: ({ row }) =>
          row.original.dob ? format(new Date(row.original.dob), 'yyyy-MM-dd') : '-',
      },
      {
        accessorKey: 'age',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Age" />,
        cell: ({ row }) => <span>{row.original.age ?? '-'}</span>,
      },
      {
        accessorKey: 'gender',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Gender" />,
        cell: ({ row }) => <span>{row.original.gender || '-'}</span>,
      },
      {
        accessorKey: 'phone',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Phone" />,
        cell: ({ row }) => <span>{row.original.phone || '-'}</span>,
      },
      {
        accessorKey: 'email',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Email" />,
        cell: ({ row }) => <span>{row.original.email || '-'}</span>,
      },
      {
        accessorKey: 'group',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Group" />,
        cell: ({ row }) => <span>{row.original.group || '-'}</span>,
      },
      {
        accessorKey: 'level',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Level" />,
        cell: ({ row }) => {
          const record = row.original;
          return (
            <Link
              href={`${basePath}/do/${record.studentId}/${record.eventId}?studentName=${encodeURIComponent(record.name)}`}
              className="text-primary hover:underline underline-offset-2"
            >
              {record.level || '-'}
            </Link>
          );
        },
      },
      {
        accessorKey: 'height',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Height (cm)" />,
        cell: ({ row }) =>
          row.original.height != null ? String(row.original.height) : '-',
      },
      {
        accessorKey: 'weight',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Weight (kg)" />,
        cell: ({ row }) =>
          row.original.weight != null ? String(row.original.weight) : '-',
      },
      {
        accessorKey: 'comments',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Comments" />,
        cell: ({ row }) => {
          const record = row.original;
          return (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => {
                setSelectedStudentForComment({
                  studentId: record.studentId,
                  name: record.name,
                  eventId: record.eventId,
                  eventName: record.eventName,
                  eventDate: record.eventDate,
                });
                setCommentDialogOpen(true);
              }}
            >
              Add
            </Button>
          );
        },
      },
      {
        accessorKey: 'result',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Result" />,
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="flex gap-2 items-center">
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild title="View result">
                <Link
                  href={`${basePath}/view/${record.studentId}/${record.eventId}?studentName=${encodeURIComponent(record.name)}`}
                >
                  <Eye className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 p-0" asChild>
                <Link
                  href={`${basePath}/past/${record.studentId}?studentName=${encodeURIComponent(record.name)}`}
                >
                  Old
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 p-0" asChild>
                <Link
                  href={`${basePath}/average/${record.studentId}/${record.eventId}?studentName=${encodeURIComponent(record.name)}`}
                >
                  Avg
                </Link>
              </Button>
              <Button size="sm" variant="ghost" className="h-8 p-0" asChild>
                <Link
                  href={`${basePath}/graph/${record.studentId}/${record.eventId}?studentName=${encodeURIComponent(record.name)}`}
                >
                  Graph
                </Link>
              </Button>
            </div>
          );
        },
      },
    ],
    [basePath]
  );

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    state: { pagination, sorting },
    pageCount: data?.pagination?.total
      ? Math.ceil(data.pagination.total / pagination.pageSize)
      : -1,
    manualPagination: true,
    manualSorting: true,
  });

  const clearSearch = () => setSearchQuery('');
  const selectedEvent = eventsData?.find((e: EventType) => String(e.id) === eventFilter);

  const getApiParams = (page = 1, limit = 100) => {
    const sortField = sorting?.[0]?.id || 'name';
    const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';
    return new URLSearchParams({
      page: String(page),
      limit: String(limit),
      ...(sortField ? { sort: sortField, dir: sortDirection } : {}),
      ...(searchQuery ? { query: searchQuery } : {}),
      ...(eventFilter !== 'all' ? { eventId: eventFilter } : {}),
      ...(levelFilter !== 'all' ? { level: levelFilter } : {}),
      ...(fitnessSkillFilter !== 'all' ? { fitnessSkillId: fitnessSkillFilter } : {}),
    });
  };

  const escapeCsv = (val: unknown) => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const formatRowForExport = (r: AssessmentRecord) => [
    r.name,
    r.dob ? format(new Date(r.dob), 'yyyy-MM-dd') : '',
    r.age ?? '',
    r.gender || '',
    r.phone || '',
    r.email || '',
    r.group || '',
    r.level || '',
    r.eventName || '',
    r.registrationNo || '',
  ];

  const handleCopy = async () => {
    const rows = data?.data || [];
    const headers = ['Name', 'DOB', 'Age', 'Gender', 'Phone', 'Email', 'Group', 'Level', 'Event', 'Registration No'];
    const lines = [headers.join('\t'), ...rows.map((r) => formatRowForExport(r).join('\t'))];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(`Copied ${rows.length} row(s) to clipboard`);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = lines.join('\n');
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleCSV = async () => {
    const pageSize = 100;
    let currentPage = 1;
    let total = 0;
    const allRows: AssessmentRecord[] = [];
    do {
      const params = getApiParams(currentPage, pageSize);
      const response = await apiFetch(
        withParams(API_PATHS.fitnessAssessment.assessment.list, params)
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to fetch data for export');
      }
      const json = await response.json();
      const rows: AssessmentRecord[] = json?.data ?? [];
      total = json?.pagination?.total ?? rows.length;
      allRows.push(...rows);
      currentPage += 1;
    } while (allRows.length < total);

    const headers = ['Name', 'DOB', 'Age', 'Gender', 'Phone', 'Email', 'Group', 'Level', 'Event', 'Registration No'];
    const lines = [
      headers.map(escapeCsv).join(','),
      ...allRows.map((r) => formatRowForExport(r).map(escapeCsv).join(',')),
    ];
    const csvBlob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitness-assessment-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${allRows.length} row(s) to CSV`);
  };

  const DataGridToolbar = () => (
    <CardHeader>
      <CardToolbar>
        <div className="flex flex-1 items-center space-x-2 flex-wrap gap-2">
          <span className="text-sm font-medium">Fitness Assessment</span>
          <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                role="combobox"
                aria-expanded={eventSearchOpen}
                className="w-[250px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0 opacity-50" />
                  <span className="truncate">
                    {selectedEvent ? selectedEvent.name : 'SEARCH EVENT'}
                  </span>
                </div>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
              <Command>
                <CommandInput placeholder="Search events..." />
                <CommandList>
                  <CommandEmpty>No events found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="all"
                      onSelect={() => {
                        setEventFilter('all');
                        setEventSearchOpen(false);
                        setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', eventFilter === 'all' ? 'opacity-100' : 'opacity-0')} />
                      All Events
                    </CommandItem>
                    {eventsData?.map((event: EventType) => (
                      <CommandItem
                        key={event.id}
                        value={`${event.name} ${event.event_type || ''}`}
                        onSelect={() => {
                          setEventFilter(String(event.id));
                          setEventSearchOpen(false);
                          setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            eventFilter === String(event.id) ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{event.name}</span>
                          {event.event_type && (
                            <span className="text-xs text-muted-foreground">{event.event_type}</span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter: Type to filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            {searchQuery && (
              <Button variant="ghost" size="sm" className="absolute right-1 top-1 h-6 w-6 p-0" onClick={clearSearch}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Select
            value={levelFilter}
            onValueChange={(value) => {
              setLevelFilter(value);
              setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {levelsList?.map((level: { id: string; levelName: string }) => (
                <SelectItem key={level.id} value={level.levelName}>
                  {level.levelName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={fitnessSkillFilter}
            onValueChange={(value) => {
              setFitnessSkillFilter(value);
              setPagination({ pageIndex: 0, pageSize: pagination.pageSize });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Fitness Skill" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fitness Skills</SelectItem>
              {fitnessSkillsList?.map((skill: { id: number; name: string; level: string }) => (
                <SelectItem key={skill.id} value={String(skill.id)}>
                  {skill.name} ({skill.level})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Show:</span>
          <Select
            value={String(pagination.pageSize)}
            onValueChange={(value) => {
              setPagination({ pageIndex: 0, pageSize: Number(value) });
            }}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            COPY
          </Button>
          <Button variant="outline" size="sm" onClick={handleCSV}>
            CSV
          </Button>
        </div>
      </CardToolbar>
    </CardHeader>
  );

  return (
    <>
      {selectedStudent && (
        <FitnessAssessmentForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setSelectedStudent(null);
          }}
          studentId={selectedStudent.id}
          studentName={selectedStudent.name}
          eventId={selectedStudent.eventId}
        />
      )}
      <DataGrid
        table={table}
        recordCount={data?.pagination?.total || 0}
        isLoading={isLoading}
        tableLayout={{
          columnsResizable: true,
          columnsPinnable: true,
          columnsMovable: true,
          columnsVisibility: true,
        }}
        tableClassNames={{ edgeCell: 'px-5' }}
      >
        <Card>
          <DataGridToolbar />
          <CardTable>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter>
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>
      {selectedStudentForResults && (
        <FitnessAssessmentResults
          open={resultsOpen}
          onClose={() => {
            setResultsOpen(false);
            setSelectedStudentForResults(null);
          }}
          studentName={selectedStudentForResults.name}
          results={assessmentResults?.data || null}
          comments={assessmentResults?.comments ?? null}
          isLoading={isLoadingResults}
          studentHeight={assessmentResults?.studentHeight ?? null}
          studentWeight={assessmentResults?.studentWeight ?? null}
          eventName={assessmentResults?.eventName ?? null}
        />
      )}
      {selectedStudentForComment && (
        <FitnessAssessmentCommentDialog
          open={commentDialogOpen}
          onClose={() => {
            setCommentDialogOpen(false);
            setSelectedStudentForComment(null);
          }}
          studentId={selectedStudentForComment.studentId}
          studentName={selectedStudentForComment.name}
          eventId={selectedStudentForComment.eventId}
          eventName={selectedStudentForComment.eventName}
          eventDate={selectedStudentForComment.eventDate}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['fitness-assessment'] })}
        />
      )}
    </>
  );
};

export default FitnessAssessmentList;
