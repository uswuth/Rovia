import { useMemo } from 'react';
import { getTeamsApi } from '@/api/teams/teams.api';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';

export const useTeams = () => {
  const { isAuthenticated } = useAuth();

  const { data, loading, error, refetch } = useQuery<Record<string, unknown>[]>(
    queryKeys.teams.list(),
    () => getTeamsApi(),
    { enabled: isAuthenticated, list: true }
  );

  const teams = useMemo(() => data ?? [], [data]);

  return {
    teams,
    loading: loading && !data,
    error,
    refetch,
  };
};
