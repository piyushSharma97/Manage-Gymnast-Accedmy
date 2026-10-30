'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  DataGrid,
} from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import {
  DataGridTable,
} from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type CenterPerformanceData = {
  academyId: number;
  academyName: string;
  centerId: number;
  centerName: string;
  centerCode: string;
  studentCount: number;
  totalRevenue: number;
  platformOwnerRevenue: number;
};

type ReportResponse = {
  data: CenterPerformanceData[];
  totals: {
    totalStudents: number;
    totalRevenue: number;
    totalPlatformOwnerRevenue: number;
  };
  summary: {
    totalCenters: number;
    totalAcademies: number;
  };
};

type Tenant = {
  id: number;
  academyName: string;
};

type ChartDataPoint = {
  period: string;
  label: string;
  revenue: number;
  platformOwnerRevenue: number;
  newStudents: number;
};

type ChartsResponse = {
  data: ChartDataPoint[];
  groupBy: string;
  start: string;
  end: string;
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const ReportsPage = () => {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'totalRevenue', desc: true },
  ]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [chartGroupBy, setChartGroupBy] = useState<'week' | 'month'>('month');

  // Fetch tenants for filter dropdown
  const { data: tenantsData } = useQuery({
    queryKey: ['owner-tenants-select'],
    queryFn: async () => {
      const response = await apiFetch(API_PATHS.tenantManagement.select);
      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }
      return response.json() as Promise<Tenant[]>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch report data
  const { data, isLoading } = useQuery({
    queryKey: [
      'owner-center-performance',
      tenantFilter,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tenantFilter !== 'all') {
        params.append('tenantId', tenantFilter);
      }
      if (startDate) {
        params.append('startDate', startDate);
      }
      if (endDate) {
        params.append('endDate', endDate);
      }

      const response = await apiFetch(
        withParams(API_PATHS.owner.reports.centerPerformance, params),
      );

      if (!response.ok) {
        throw new Error('Failed to fetch report data');
      }

      return response.json() as Promise<ReportResponse>;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch chart time-series data (weeks or months)
  const { data: chartsData, isLoading: chartsLoading } = useQuery({
    queryKey: [
      'owner-reports-charts',
      chartGroupBy,
      tenantFilter,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('groupBy', chartGroupBy);
      if (tenantFilter !== 'all') params.append('tenantId', tenantFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const response = await apiFetch(
        withParams(API_PATHS.owner.reports.charts, params),
      );
      if (!response.ok) throw new Error('Failed to fetch chart data');
      return response.json() as Promise<ChartsResponse>;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    
    let filtered = data.data;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.academyName.toLowerCase().includes(query) ||
          item.centerName.toLowerCase().includes(query) ||
          item.centerCode.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [data?.data, searchQuery]);

  // Column definitions
  const columns = useMemo<ColumnDef<CenterPerformanceData>[]>(
    () => [
      {
        id: 'serial',
        accessorFn: (_row, index) => index + 1,
        header: () => 'S.No',
        cell: ({ row }) =>
          row.index + 1 + pagination.pageIndex * pagination.pageSize,
        size: 60,
        enableSorting: false,
        meta: {
          skeleton: <Skeleton className="size-5" />,
        },
        enableResizing: false,
      },
      {
        id: 'academyName',
        accessorKey: 'academyName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Academy Name" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="font-medium">{value}</div>;
        },
        size: 200,
        enableSorting: true,
        meta: {
          headerTitle: 'Academy Name',
          skeleton: <Skeleton className="w-32 h-8" />,
        },
      },
      {
        id: 'centerName',
        accessorKey: 'centerName',
        header: ({ column }) => (
          <DataGridColumnHeader title="Center Name" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="truncate">{value}</div>;
        },
        size: 200,
        enableSorting: true,
        meta: {
          headerTitle: 'Center Name',
          skeleton: <Skeleton className="w-32 h-8" />,
        },
      },
      {
        id: 'centerCode',
        accessorKey: 'centerCode',
        header: ({ column }) => (
          <DataGridColumnHeader title="Center Code" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as string;
          return <div className="truncate text-muted-foreground">{value}</div>;
        },
        size: 120,
        enableSorting: true,
        meta: {
          headerTitle: 'Center Code',
          skeleton: <Skeleton className="w-24 h-8" />,
        },
      },
      {
        id: 'studentCount',
        accessorKey: 'studentCount',
        header: ({ column }) => (
          <DataGridColumnHeader title="Student Count" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as number;
          return (
            <div className="text-center font-medium">
              <Badge variant="secondary">{value}</Badge>
            </div>
          );
        },
        size: 120,
        enableSorting: true,
        meta: {
          headerTitle: 'Student Count',
          skeleton: <Skeleton className="w-20 h-8" />,
        },
      },
      {
        id: 'totalRevenue',
        accessorKey: 'totalRevenue',
        header: ({ column }) => (
          <DataGridColumnHeader title="Total Revenue" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as number;
          return (
            <div className="font-medium text-right">
              {formatCurrency(value)}
            </div>
          );
        },
        size: 150,
        enableSorting: true,
        meta: {
          headerTitle: 'Total Revenue',
          skeleton: <Skeleton className="w-28 h-8" />,
        },
      },
      {
        id: 'platformOwnerRevenue',
        accessorKey: 'platformOwnerRevenue',
        header: ({ column }) => (
          <DataGridColumnHeader title="Platform Owner Revenue" column={column} />
        ),
        cell: (info) => {
          const value = info.getValue() as number;
          return (
            <div className="font-semibold text-right text-primary">
              {formatCurrency(value)}
            </div>
          );
        },
        size: 180,
        enableSorting: true,
        meta: {
          headerTitle: 'Platform Owner Revenue',
          skeleton: <Skeleton className="w-32 h-8" />,
        },
      },
    ],
    [pagination.pageIndex, pagination.pageSize],
  );

  const table = useReactTable({
    columns,
    data: filteredData,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
    getRowId: (row: CenterPerformanceData) => String(row.centerId),
    state: {
      pagination,
      sorting,
    },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: false,
    manualSorting: false,
    manualFiltering: false,
  });

  const DataGridToolbar = () => {
    const [inputValue, setInputValue] = useState(searchQuery);

    const handleSearch = () => {
      setSearchQuery(inputValue);
      setPagination({ ...pagination, pageIndex: 0 });
    };

    return (
      <CardHeader className="flex-col flex-wrap sm:flex-row items-end items-stretch sm:items-center py-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 w-full">
          <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
            <div className="relative">
              <Search className="size-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by academy or center..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isLoading}
                className="ps-9 w-full sm:w-64"
              />
              {searchQuery.length > 0 && (
                <Button
                  mode="icon"
                  variant="dim"
                  className="absolute end-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => {
                    setInputValue('');
                    setSearchQuery('');
                  }}
                >
                  <X />
                </Button>
              )}
            </div>
            <Select
              disabled={isLoading}
              onValueChange={setTenantFilter}
              value={tenantFilter}
              defaultValue="all"
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by academy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Academies</SelectItem>
                {tenantsData?.map((tenant) => (
                  <SelectItem key={tenant.id} value={String(tenant.id)}>
                    {tenant.academyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={isLoading}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              placeholder="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isLoading}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      </CardHeader>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Center Performance & Revenue Summary
        </h1>
        <p className="text-muted-foreground mt-2">
          View student count and revenue collected for each center across all academies
        </p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Academies</CardDescription>
              <CardTitle className="text-2xl">
                {data.summary.totalAcademies}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Centers</CardDescription>
              <CardTitle className="text-2xl">
                {data.summary.totalCenters}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Students</CardDescription>
              <CardTitle className="text-2xl">
                {data.totals.totalStudents.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Platform Owner Revenue</CardDescription>
              <CardTitle className="text-2xl">
                {formatCurrency(data.totals.totalPlatformOwnerRevenue)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Academy Charts - by Week or Month */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Academy performance over time</CardTitle>
            <CardDescription>
              Revenue and new students by {chartGroupBy === 'week' ? 'week' : 'month'}. Use filters above for academy and date range.
            </CardDescription>
          </div>
          <Select
            value={chartGroupBy}
            onValueChange={(v) => setChartGroupBy(v as 'week' | 'month')}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">By week</SelectItem>
              <SelectItem value="month">By month</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-8">
          {chartsLoading ? (
            <div className="flex h-[320px] items-center justify-center text-muted-foreground">
              Loading charts...
            </div>
          ) : chartsData?.data?.length ? (
            <>
              <div>
                <h4 className="mb-2 text-sm font-medium">Revenue (USD)</h4>
                <ChartContainer
                  config={{
                    revenue: {
                      label: 'Revenue',
                      color: 'hsl(var(--chart-1))',
                    },
                  }}
                  className="h-[320px] w-full"
                >
                  <BarChart
                    data={chartsData.data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: chartGroupBy === 'week' ? 'Week' : 'Month',
                        position: 'insideBottom',
                        offset: -8,
                        style: { fill: 'var(--muted-foreground)' },
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                      label={{
                        value: 'Revenue (USD)',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: 'var(--muted-foreground)' },
                      }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v) => [formatCurrency(Number(v)), 'Revenue']}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.label ?? ''
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="revenue"
                      fill="var(--color-revenue)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">Platform owner revenue (USD)</h4>
                <ChartContainer
                  config={{
                    platformOwnerRevenue: {
                      label: 'Platform owner revenue',
                      color: 'hsl(var(--chart-2))',
                    },
                  }}
                  className="h-[320px] w-full"
                >
                  <BarChart
                    data={chartsData.data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: chartGroupBy === 'week' ? 'Week' : 'Month',
                        position: 'insideBottom',
                        offset: -8,
                        style: { fill: 'var(--muted-foreground)' },
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                      label={{
                        value: 'Amount (USD)',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: 'var(--muted-foreground)' },
                      }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v) => [formatCurrency(Number(v)), 'Platform revenue']}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.label ?? ''
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="platformOwnerRevenue"
                      fill="var(--color-platformOwnerRevenue)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">New students</h4>
                <ChartContainer
                  config={{
                    newStudents: {
                      label: 'New students',
                      color: 'hsl(var(--chart-3))',
                    },
                  }}
                  className="h-[320px] w-full"
                >
                  <BarChart
                    data={chartsData.data}
                    margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: chartGroupBy === 'week' ? 'Week' : 'Month',
                        position: 'insideBottom',
                        offset: -8,
                        style: { fill: 'var(--muted-foreground)' },
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: 'Number of students',
                        angle: -90,
                        position: 'insideLeft',
                        style: { fill: 'var(--muted-foreground)' },
                      }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(v) => [String(v), 'New students']}
                          labelFormatter={(_, payload) =>
                            payload?.[0]?.payload?.label ?? ''
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="newStudents"
                      fill="var(--color-newStudents)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </>
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              No chart data for the selected period. Adjust date range or academy filter.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <DataGrid
        table={table}
        recordCount={filteredData.length}
        isLoading={isLoading}
        tableLayout={{
          columnsResizable: true,
          columnsPinnable: true,
          columnsMovable: true,
          columnsVisibility: true,
        }}
        tableClassNames={{
          edgeCell: 'px-5',
        }}
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
    </div>
  );
};

export default ReportsPage;

