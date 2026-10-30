import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// Custom hook to use programs for selection
export const useProgramSelectQuery = () => {
  // Fetch programs for selection
  const fetchProgramList = async () => {
    const response = await apiFetch('/api/program/select');

    if (!response.ok) {
      toast.error(
        'Something went wrong while loading the records. Please try again.',
        {
          position: 'top-center',
        },
      );
    }

    return response.json();
  };

  return useQuery({
    queryKey: ['program-select'],
    queryFn: fetchProgramList,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
};
