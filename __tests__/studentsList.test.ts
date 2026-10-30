import { describe, expect, it } from 'vitest';
import { buildStudentSearchParams } from '@/app/admin/gymnast-management/students/components/students-list';

describe('buildStudentSearchParams', () => {
  it('generates query parameters for pagination and sorting', () => {
    const params = buildStudentSearchParams({
      page: 1,
      limit: 10,
      sortField: 'createdAt',
      sortDirection: 'desc',
    });

    expect(params.get('page')).toBe('1');
    expect(params.get('limit')).toBe('10');
    expect(params.get('sort')).toBe('createdAt');
    expect(params.get('dir')).toBe('desc');
  });

  it('includes search query and status filter when provided', () => {
    const params = buildStudentSearchParams({
      page: 2,
      limit: 25,
      sortField: 'firstName',
      sortDirection: 'asc',
      query: '  John Doe  ',
      statusFilter: 'ACTIVE',
    });

    expect(params.get('query')).toBe('John Doe');
    expect(params.get('status')).toBe('ACTIVE');
  });

  it('does not add status filter when value is all', () => {
    const params = buildStudentSearchParams({
      page: 1,
      limit: 20,
      sortField: 'lastName',
      sortDirection: 'asc',
      statusFilter: 'all',
    });

    expect(params.has('status')).toBe(false);
  });
});
