'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, withParams } from '@/lib/api-paths';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

type ApparatusStats = {
  apparatusName: string;
  totalScore: number;
  studentCount: number;
  avgScore: number;
  studentScore: number;
};

const TeamAveragePage = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params?.studentId as string;
  const eventId = params?.eventId as string;
  const studentName = searchParams?.get('studentName') || 'Student';

  const [filterText, setFilterText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch team average data
  const { data, isLoading, error } = useQuery({
    queryKey: ['team-average', studentId, eventId],
    queryFn: async () => {
      const response = await apiFetch(
        withParams(API_PATHS.skillsAssessment.assessment.teamAverage, `studentId=${studentId}&eventId=${eventId}`)
      );
      if (!response.ok) throw new Error('Failed to fetch team average data');
      return response.json();
    },
    enabled: !!studentId && !!eventId,
  });

  // Filter and paginate data
  const filteredData = useMemo(() => {
    if (!data?.data) return [];
    const filtered = data.data.filter((item: ApparatusStats) =>
      item.apparatusName.toLowerCase().includes(filterText.toLowerCase())
    );
    return filtered;
  }, [data?.data, filterText]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);

  // Export handlers
  const handleCopy = async () => {
    const headers = ['Apparatus', 'Total Score', 'No. of Kids', 'Avg Score', 'Your score'];
    const rows = filteredData.map((item: ApparatusStats) => [
      item.apparatusName,
      item.totalScore,
      item.studentCount,
      item.avgScore,
      item.studentScore,
    ]);

    const text = [
      headers.join('\t'),
      ...rows.map((row: (string | number)[]) => row.join('\t'))
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCSV = () => {
    const headers = ['Apparatus', 'Total Score', 'No. of Kids', 'Avg Score', 'Your score'];
    const rows = filteredData.map((item: ApparatusStats) => [
      item.apparatusName,
      item.totalScore,
      item.studentCount,
      item.avgScore,
      item.studentScore,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: (string | number)[]) => row.map((cell: string | number) => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `team-average-${eventId}-${Date.now()}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load team average data</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Breadcrumb */}
      <div className="text-sm text-muted-foreground">
        <Link href="/manager" className="hover:text-primary">Home</Link>
        {' / '}
        <Link href="/manager/skills-assessment/assessment" className="hover:text-primary">Gymnasts</Link>
        {' / '}
        <Link href="/manager/skills-assessment/assessment" className="hover:text-primary">Assessment</Link>
        {' / '}
        <span>Average Skill Score for team - {data?.eventType || 'Assessment'}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Average Skill Score for team
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Event: {data?.eventName} | Student: {studentName}
          </p>
        </CardHeader>
        <CardContent>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Filter: Type to filter..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show:</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
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
              <Button variant="outline" size="sm" onClick={handlePrint}>
                PRINT
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apparatus</TableHead>
                  <TableHead className="text-right">Total Score</TableHead>
                  <TableHead className="text-right">No. of Kids</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">Your score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No data available
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item: ApparatusStats, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.apparatusName}</TableCell>
                      <TableCell className="text-right">{item.totalScore}</TableCell>
                      <TableCell className="text-right">{item.studentCount}</TableCell>
                      <TableCell className="text-right">{item.avgScore}</TableCell>
                      <TableCell className="text-right">{item.studentScore}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Showing {filteredData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamAveragePage;
