import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// Custom hook to use teams for selection
export const useTeamSelectQuery = () => {
  // Fetch teams for selection
  const fetchTeamList = async () => {
    const response = await apiFetch('/api/team/select');

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
    queryKey: ['team-select'],
    queryFn: fetchTeamList,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
};
