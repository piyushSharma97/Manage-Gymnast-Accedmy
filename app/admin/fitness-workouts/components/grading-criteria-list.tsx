'use client';
import { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Check, ChevronsUpDown, Pencil, Trash2, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/api-paths';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
  CardToolbar,
} from '@/components/ui/card';
import {
  Command,
  CommandCheck,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GradingCriteriaEditDialog from './grading-criteria-edit-dialog';
import GradingCriteriaDeleteDialog from './grading-criteria-delete-dialog';

type Criterion = {
  id: number;
  fitnessSkillId: number;
  level: string;
  description: string | null;
  targetValue: string | null;
  fitnessSkill?: {
    id: number;
    name: string;
    unitOfMeasurement: string;
    fitnessCategory?: { id: number; name: string };
  };
};

const apiBasePath = '/api/administration/fitness-grading-criteria';
const queryKey = 'admin-fitness-grading-criteria';

export default function GradingCriteriaList() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([{ id: 'level', desc: false }]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [skillComboboxOpen, setSkillComboboxOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedCriterion, setSelectedCriterion] = useState<Criterion | null>(null);

  const sortField = sorting[0]?.id || 'level';
  const sortDir = sorting[0]?.desc ? 'desc' : 'asc';

  const { data: categories = [] } = useQuery({
    queryKey: ['fitness-categories-select'],
    queryFn: async () => {
      const res = await apiFetch(API_PATHS.administration.fitnessCategories.select);
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const { data: skillsData } = useQuery({
    queryKey: ['fitness-skills-all'],
    queryFn: async () => {
      const res = await apiFetch('/api/administration/fitness-skills?limit=500');
      if (!res.ok) throw new Error('Failed to fetch skills');
      return res.json();
    },
  });
  const allSkills = (skillsData?.data ?? []) as Array<{
    id: number;
    name: string;
    unitOfMeasurement: string;
    fitnessCategoryId?: number;
    fitnessCategory?: { id: number; name: string };
  }>;
  const skillsByCategory =
    categoryFilter === 'all'
      ? allSkills
      : allSkills.filter((s) => String(s.fitnessCategory?.id ?? s.fitnessCategoryId) === categoryFilter);

  const params = new URLSearchParams({
    page: String(pagination.pageIndex + 1),
    limit: String(pagination.pageSize),
    sort: sortField,
    dir: sortDir,
    ...(searchQuery ? { query: searchQuery } : {}),
    ...(categoryFilter !== 'all' ? { categoryId: categoryFilter } : {}),
    ...(skillFilter !== 'all' ? { fitnessSkillId: skillFilter } : {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: [queryKey, pagination, sorting, searchQuery, categoryFilter, skillFilter],
    queryFn: async () => {
      const res = await apiFetch(`${apiBasePath}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<ColumnDef<Criterion>[]>(
    () => [
      {
        id: 'level',
        accessorKey: 'level',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Level" />,
        cell: (info) => <Badge variant="secondary">{info.getValue() as string}</Badge>,
        size: 120,
      },
      {
        id: 'skillName',
        accessorFn: (row) => row.fitnessSkill?.name ?? row.fitnessSkillId,
        header: ({ column }) => <DataGridColumnHeader column={column} title="Skill" />,
        cell: (info) => {
          const row = info.row.original;
          const name = row.fitnessSkill?.name ?? `Skill #${row.fitnessSkillId}`;
          const unit = row.fitnessSkill?.unitOfMeasurement;
          return unit ? `${name} (${unit})` : name;
        },
        size: 200,
      },
      {
        id: 'category',
        accessorFn: (row) => row.fitnessSkill?.fitnessCategory?.name ?? '',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Category" />,
        cell: (info) => (info.getValue() as string) || '—',
        size: 140,
      },
      {
        id: 'description',
        accessorKey: 'description',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Description" />,
        cell: (info) => {
          const v = info.getValue() as string | null;
          return <span className="truncate max-w-[200px] block">{v || '—'}</span>;
        },
        size: 200,
      },
      {
        id: 'targetValue',
        accessorKey: 'targetValue',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Target value" />,
        cell: (info) => (info.getValue() as string) || '—',
        size: 120,
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-primary"
                onClick={() => {
                  setSelectedCriterion(c);
                  setEditOpen(true);
                }}
                title="Edit"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive/80 hover:text-destructive"
                onClick={() => {
                  setSelectedCriterion(c);
                  setDeleteOpen(true);
                }}
                title="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
        size: 100,
        enableSorting: false,
      },
    ],
    []
  );

  const table = useReactTable({
    data: data?.data ?? [],
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
    getRowId: (row) => String(row.id),
  });

  const clearFilters = () => {
    setCategoryFilter('all');
    setSkillFilter('all');
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  };

  return (
    <>
      <DataGrid
        table={table}
        recordCount={data?.pagination?.total ?? 0}
        isLoading={isLoading}
        tableLayout={{ columnsResizable: true, columnsVisibility: true }}
        tableClassNames={{ edgeCell: 'px-5' }}
      >
        <Card>
          <CardHeader>
            <CardToolbar>
              <div className="flex flex-1 items-center space-x-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search level, description, target..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                    }}
                    className="pl-8"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => {
                        setSearchQuery('');
                        setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                      }}
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
                <Select
                  value={categoryFilter}
                  onValueChange={(v) => {
                    setCategoryFilter(v);
                    setSkillFilter('all');
                    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {(categories as { id: number; name: string }[]).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover open={skillComboboxOpen} onOpenChange={setSkillComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      role="combobox"
                      aria-expanded={skillComboboxOpen}
                      className="w-[180px] justify-between font-normal"
                    >
                      <span className={cn(skillFilter === 'all' && 'text-muted-foreground')}>
                        {skillFilter === 'all'
                          ? 'Skill'
                          : skillsByCategory.find((s) => String(s.id) === skillFilter)?.name ?? 'Skill'}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search skills..." />
                      <CommandList>
                        <CommandEmpty>No skill found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setSkillFilter('all');
                              setSkillComboboxOpen(false);
                              setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                            }}
                          >
                            <CommandCheck icon={Check} className={skillFilter === 'all' ? 'opacity-100' : 'opacity-0'} />
                            All Skills
                          </CommandItem>
                          {skillsByCategory.map((s) => {
                            const label = `${s.name} (${s.unitOfMeasurement})`;
                            return (
                              <CommandItem
                                key={s.id}
                                value={label}
                                onSelect={() => {
                                  setSkillFilter(String(s.id));
                                  setSkillComboboxOpen(false);
                                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                                }}
                              >
                                <CommandCheck
                                  icon={Check}
                                  className={skillFilter === String(s.id) ? 'opacity-100' : 'opacity-0'}
                                />
                                {label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center space-x-2">
                {(categoryFilter !== 'all' || skillFilter !== 'all') && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedCriterion(null);
                    setEditOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Fitness Workout  
                </Button>
              </div>
            </CardToolbar>
          </CardHeader>
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

      <GradingCriteriaEditDialog
        open={editOpen}
        closeDialog={() => {
          setEditOpen(false);
          setSelectedCriterion(null);
        }}
        criterion={selectedCriterion}
        fitnessSkillId={selectedCriterion?.fitnessSkillId ?? 0}
        skillName={selectedCriterion?.fitnessSkill?.name}
        skillsForAdd={selectedCriterion ? undefined : allSkills}
        queryKey={queryKey}
      />

      {selectedCriterion && (
        <GradingCriteriaDeleteDialog
          open={deleteOpen}
          closeDialog={() => {
            setDeleteOpen(false);
            setSelectedCriterion(null);
          }}
          criterion={selectedCriterion}
          queryKey={queryKey}
        />
      )}
    </>
  );
}
