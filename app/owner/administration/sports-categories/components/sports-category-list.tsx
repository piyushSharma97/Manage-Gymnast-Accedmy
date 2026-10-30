'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
	ColumnDef,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	PaginationState,
	RowSelectionState,
	SortingState,
	useReactTable,
} from '@tanstack/react-table';
import { Pencil, Trash2, Plus, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import {
	DataGridTable,
	DataGridTableRowSelect,
	DataGridTableRowSelectAll,
} from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Local dialogs
import SportsCategoryEditDialog from './sports-category-edit-dialog';
import SportsCategoryDeleteDialog from './sports-category-delete-dialog';
import SportsCategoryGroupDeleteDialog from './sports-category-group-delete-dialog';

type SportsCategory = {
	id: number;
	categoryName: string;
	description: string | null;
	isActive: boolean;
	createdAt: string;
};

const SportsCategoryList = () => {
	const queryClient = useQueryClient();

	// List state
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
	const [sorting, setSorting] = useState<SortingState>([{ id: 'categoryName', desc: false }]);
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	// Dialog state
	const [editDialogOpen, setEditDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [groupDeleteDialogOpen, setGroupDeleteDialogOpen] = useState(false);
	const [editRecord, setEditRecord] = useState<SportsCategory | null>(null);
	const [deleteRecord, setDeleteRecord] = useState<SportsCategory | null>(null);
	const [deleteIds, setDeleteIds] = useState<string[]>([]);

	// Filters/search
	const [searchQuery, setSearchQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<string>('all');

	// Mutation for toggling active status
	const toggleActiveMutation = useMutation({
		mutationFn: async ({ categoryId, isActive }: { categoryId: number; isActive: boolean }) => {
			const response = await apiFetch(API_PATHS.administration.sportsCategories.byId(String(categoryId)), {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isActive }),
			});

			if (!response.ok) {
				const { message } = await response.json();
				throw new Error(message || 'Failed to update category status');
			}

			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['admin-sports-categories'] });
		},
	});

	// Build fetcher
	const fetchCategories = async ({ pageIndex, pageSize, sorting, searchQuery }: DataGridApiFetchParams): Promise<DataGridApiResponse<SportsCategory>> => {
		const sortField = sorting?.[0]?.id || 'categoryName';
		const sortDirection = sorting?.[0]?.desc ? 'desc' : 'asc';

		const params = new URLSearchParams({
			page: String((pageIndex ?? 0) + 1),
			limit: String(pageSize),
			...(sortField ? { sort: sortField, dir: sortDirection } : {}),
			...(searchQuery ? { query: searchQuery } : {}),
			...(activeFilter !== 'all' ? { active: activeFilter } : {}),
		});

		const response = await apiFetch(withParams(API_PATHS.administration.sportsCategories.list, params));
		if (!response.ok) {
			throw new Error('Failed to load sports categories');
		}
		return response.json();
	};

	const { data, isLoading } = useQuery({
		queryKey: ['admin-sports-categories', pagination, sorting, searchQuery, activeFilter],
		queryFn: () =>
			fetchCategories({
				pageIndex: pagination.pageIndex,
				pageSize: pagination.pageSize,
				sorting,
				searchQuery,
			}),
		placeholderData: keepPreviousData,
		staleTime: Infinity,
		gcTime: 1000 * 60 * 60,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
		retry: 1,
	});

	useEffect(() => {
		const selectedRowIds = Object.keys(rowSelection);
		setDeleteIds(selectedRowIds);
	}, [rowSelection]);

	// Columns
	const columns = useMemo<ColumnDef<SportsCategory>[]>(
		() => [
			{
				id: 'id',
				accessorKey: 'id',
				header: () => <DataGridTableRowSelectAll />,
				cell: ({ row }) => <DataGridTableRowSelect row={row} />,
				size: 27,
				enableSorting: false,
				meta: { skeleton: <Skeleton className="size-5" /> },
				enableResizing: false,
			},
			{
				id: 'categoryName',
				accessorKey: 'categoryName',
				header: ({ column }) => (
					<DataGridColumnHeader title="Category" column={column} />
				),
				cell: (info) => info.getValue(),
				size: 240,
				enableSorting: true,
				meta: { headerTitle: 'Category', skeleton: <Skeleton className="w-28 h-8" /> },
			},
			{
				id: 'description',
				accessorKey: 'description',
				header: ({ column }) => (
					<DataGridColumnHeader title="Description" column={column} />
				),
				cell: (info) => {
					const value = info.getValue() as string | null;
					return <div className="truncate">{value || '-'}</div>;
				},
				size: 300,
				enableSorting: false,
				meta: { headerTitle: 'Description', skeleton: <Skeleton className="w-48 h-8" /> },
			},
			{
				id: 'isActive',
				accessorKey: 'isActive',
				header: ({ column }) => (
					<DataGridColumnHeader title="Active" column={column} />
				),
				cell: ({ row }) => {
					const category = row.original;
					const handleToggle = (checked: boolean) => {
						toggleActiveMutation.mutate({
							categoryId: category.id,
							isActive: checked,
						});
					};

					return (
						<Switch
							checked={category.isActive}
							onCheckedChange={handleToggle}
							disabled={toggleActiveMutation.isPending}
						/>
					);
				},
				size: 100,
				enableSorting: true,
				meta: { headerTitle: 'Active', skeleton: <Skeleton className="w-14 h-8" /> },
			},
			{
				id: 'actions',
				header: 'Actions',
				cell: ({ row }) => {
					const category = row.original;
					return (
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									setEditRecord(category);
									setEditDialogOpen(true);
								}}
								title="Edit"
							>
								<Pencil className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => {
									setDeleteRecord(category);
									setDeleteDialogOpen(true);
								}}
								title="Delete"
							>
								<Trash2 className="h-4 w-4 text-destructive" />
							</Button>
						</div>
					);
				},
				size: 90,
				enableSorting: false,
				enableHiding: false,
				enableResizing: false,
				meta: { skeleton: <Skeleton className="size-5" /> },
			},
		],
		[activeFilter, toggleActiveMutation],
	);

	const [columnOrder, setColumnOrder] = useState<string[]>(columns.map((c) => c.id as string));

	const table = useReactTable({
		columns,
		data: data?.data || [],
		pageCount: Math.ceil((data?.pagination.total || 0) / pagination.pageSize),
		getRowId: (row: SportsCategory) => String(row.id),
		state: { pagination, sorting, columnOrder, rowSelection },
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onColumnOrderChange: setColumnOrder,
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true,
	});

	const Toolbar = () => {
		const [inputValue, setInputValue] = useState(searchQuery);
		const handleSearch = () => { setSearchQuery(inputValue); setPagination({ ...pagination, pageIndex: 0 }); };
		return (
			<CardHeader className="flex-col flex-wrap sm:flex-row items-end items-stretch sm:items-center py-5">
				<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
					<div className="relative">
						<Search className="size-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
						<Input
							placeholder="Search categories"
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
							disabled={isLoading}
							className="ps-9 w-full sm:w-64"
						/>
						{searchQuery.length > 0 && (
							<Button mode="icon" variant="dim" className="absolute end-1.5 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setSearchQuery('')}>
								<X />
							</Button>
						)}
					</div>
					<Select disabled={isLoading} onValueChange={(v) => setActiveFilter(v)} value={activeFilter} defaultValue="all">
						<SelectTrigger className="w-full sm:w-36">
							<SelectValue placeholder="Filter by status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="true">Active</SelectItem>
							<SelectItem value="false">Inactive</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<CardToolbar>
					{deleteIds.length > 0 && (
						<Button variant="destructive" onClick={() => setGroupDeleteDialogOpen(true)}>
							Delete {deleteIds.length} categories
						</Button>
					)}
					<Button disabled={isLoading} onClick={() => { setEditRecord(null); setEditDialogOpen(true); }}>
						<Plus />
						Add Category
					</Button>
				</CardToolbar>
			</CardHeader>
		);
	};

	return (
		<>
			<DataGrid
				table={table}
				recordCount={data?.pagination.total || 0}
				isLoading={isLoading}
				tableLayout={{ columnsResizable: true, columnsPinnable: true, columnsMovable: true, columnsVisibility: true }}
				tableClassNames={{ edgeCell: 'px-5' }}
			>
				<Card>
					<Toolbar />
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

			<SportsCategoryEditDialog open={editDialogOpen} closeDialog={() => setEditDialogOpen(false)} category={editRecord} />

			{deleteRecord && (
				<SportsCategoryDeleteDialog open={deleteDialogOpen} closeDialog={() => setDeleteDialogOpen(false)} category={deleteRecord} />
			)}

			{deleteIds.length > 0 && (
				<SportsCategoryGroupDeleteDialog open={groupDeleteDialogOpen} closeDialog={() => { setGroupDeleteDialogOpen(false); setRowSelection({}); }} categoryIds={deleteIds} />
			)}
		</>
	);
};

export default SportsCategoryList;


