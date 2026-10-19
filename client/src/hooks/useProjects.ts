import { useCallback, useMemo, useState } from 'react';
import { getProjects } from '@/api/project/project.api';
import { getProjectId, type Project } from '@/types/project.types';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useQueryClient } from '@tanstack/react-query';

/** Only the selected project id is stored; the project is derived from the list, so it cannot drift. */
export const useProjects = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<Project[]>(
    queryKeys.projects.list(),
    () => getProjects(),
    { enabled: isAuthenticated, list: true }
  );

  // Memoized so its identity is stable; the useMemo below depends on it.
  const projects = useMemo(() => data ?? [], [data]);

  const selectedProject = useMemo(() => {
    if (projects.length === 0) return null;
    const match = projects.find((p) => getProjectId(p) === selectedProjectId);
    return match ?? projects[0];
  }, [projects, selectedProjectId]);

  const setSelectedProject = useCallback((proj: Project | null) => {
    setSelectedProjectId(proj ? getProjectId(proj) : null);
  }, []);

  const addProject = useCallback(
    (proj: Project) => {
      // Seed the cache so the new project appears immediately; the server stays the source of truth.
      queryClient.setQueryData<Project[]>(queryKeys.projects.list(), (prev) =>
        prev ? [proj, ...prev] : [proj]
      );
      setSelectedProjectId(getProjectId(proj));
    },
    [queryClient]
  );

  return {
    projects,
    selectedProject,
    setSelectedProject,
    loading: loading && !data,
    error,
    addProject,
  };
};

