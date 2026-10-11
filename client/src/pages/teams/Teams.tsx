import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { deleteTeamApi } from '@/api/teams/teams.api';
import { useAuth } from '@/context/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { useProjects } from '@/hooks/useProjects';
import { useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useDebounce } from '@/hooks/useDebounce';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import { getProjectId, getProjectName } from '@/types/project.types';
import { getTeamColumns, type TeamRosterModalState } from './Teams.TanCol';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');

  const { teams, loading: teamsLoading } = useTeams();
  const { projects, loading: projectsLoading } = useProjects();
  const loading = teamsLoading || (projectsLoading && projects.length === 0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [rosterModal, setRosterModal] = useState<TeamRosterModalState | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeamApi(teamId),
    invalidates: [queryKeys.teams.list()],
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to delete team.');
    },
  });

  const handleDelete = useCallback((teamId: string) => {
    if (!confirm('Are you sure you want to delete this Team?')) return;
    deleteMutation.mutate(teamId);
  }, [deleteMutation]);

  const filteredTeams = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return teams.filter((t) => {
      const nameStr = (t.teamName as string) || '';
      const codeStr = (t.teamCode as string) || '';
      const matchesSearch =
        !query ||
        nameStr.toLowerCase().includes(query) ||
        codeStr.toLowerCase().includes(query);

      const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
      const projId = projObj ? ((projObj.projectId || projObj._id) as string) : (t.projectId as string);
      const matchesProj = selectedProjectFilter === 'ALL' || projId === selectedProjectFilter;

      return matchesSearch && matchesProj;
    });
  }, [teams, debouncedSearch, selectedProjectFilter]);

  const projectFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: 'ALL', label: 'All Projects' },
      ...projects.map((p) => {
        const pId = getProjectId(p);
        const pName = getProjectName(p) || 'Unnamed Project';
        return {
          value: pId,
          label: pName,
        };
      }),
    ];
  }, [projects]);

  const totalItems = filteredTeams.length;

  const columns = useMemo(
    () =>
      getTeamColumns({
        navigate,
        isAdmin,
        isSuperAdmin,
        onOpenRoster: setRosterModal,
        onDelete: handleDelete,
      }),
    [navigate, isAdmin, isSuperAdmin, setRosterModal, handleDelete]
  );

  if (loading) {
    return (
      <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="w-full space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <Users size={24} className="text-emerald-500" />
              <span>Teams</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your workspace project sub-teams, lead assignments, and team rosters.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button onClick={() => navigate('/teams/new')} className="gap-2 cursor-pointer">
                <Plus size={16} />
                <span>Create Team</span>
              </Button>
            )}
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search teams by name or code..."
              className="max-w-xs h-9 text-xs"
            />
            <div className="w-48">
              <SearchableSelect
                value={selectedProjectFilter}
                onChange={(val) => {
                  setSelectedProjectFilter(val || 'ALL');
                  setCurrentPage(1);
                }}
                options={projectFilterOptions}
                placeholder="All Projects"
                searchPlaceholder="Search projects..."
                className="w-full text-xs"
              />
            </div>
          </div>
        </div>

        {/* Data Table Container */}
        {filteredTeams.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No project teams found"
            description={
              search || selectedProjectFilter !== 'ALL'
                ? 'Try adjusting your search query or project filter.'
                : 'Get started by creating a new sub-team under a project.'
            }
            actionLabel={isAdmin && selectedProjectFilter === 'ALL' && !search ? 'Create Team' : undefined}
            onAction={isAdmin && selectedProjectFilter === 'ALL' && !search ? () => navigate('/teams/new') : undefined}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filteredTeams}
            keyExtractor={(t) => (t.teamId || t._id || t.teamCode || '') as string}
            page={currentPage}
            pageSize={pageSize}
            totalCount={totalItems}
            onPageChange={setCurrentPage}
          />
        )}

        {/* Full Roster Detail Modal */}
        {rosterModal && (
          <RosterDetailModal
            open={rosterModal.open}
            onClose={() => setRosterModal(null)}
            title={rosterModal.title}
            projectName={rosterModal.projectName}
            teamName={rosterModal.teamName}
            members={rosterModal.members}
            value={rosterModal.value}
          />
        )}
      </div>
    </div>
  );
};

export default Teams;
