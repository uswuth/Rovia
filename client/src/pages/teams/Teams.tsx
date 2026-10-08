import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deleteTeamApi } from '@/api/teams/teams.api';
import { useAuth } from '@/context/AuthContext';
import { useTeams } from '@/hooks/useTeams';
import { useProjects } from '@/hooks/useProjects';
import { useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getProjectStatusTone } from '@/lib/status-tone';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';
import { getProjectId, getProjectName } from '@/types/project.types';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');

  const { teams, loading: teamsLoading } = useTeams();
  const { projects, loading: projectsLoading } = useProjects();
  const loading = teamsLoading || (projectsLoading && projects.length === 0);

  const [search, setSearch] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [rosterModal, setRosterModal] = useState<{
    open: boolean;
    title: string;
    projectName?: string;
    teamName?: string;
    members: Member[];
    value: Record<string, 'Host' | 'Member'>;
  } | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (teamId: string) => deleteTeamApi(teamId),
    invalidates: [queryKeys.teams.list()],
    onError: (err: unknown) => {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to delete team.');
    },
  });

  const handleDelete = (teamId: string) => {
    if (!confirm('Are you sure you want to delete this Team?')) return;
    deleteMutation.mutate(teamId);
  };

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const nameStr = (t.teamName as string) || '';
      const codeStr = (t.teamCode as string) || '';
      const matchesSearch =
        nameStr.toLowerCase().includes(search.toLowerCase()) ||
        codeStr.toLowerCase().includes(search.toLowerCase());

      const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
      const projId = projObj ? ((projObj._id || projObj.projectId) as string) : (t.projectId as string);
      const matchesProj = selectedProjectFilter === 'ALL' || projId === selectedProjectFilter;

      return matchesSearch && matchesProj;
    });
  }, [teams, search, selectedProjectFilter]);

  const totalItems = filteredTeams.length;

  const columns: Column<Record<string, unknown>>[] = [
    {
      id: 'code',
      header: 'Team Code',
      width: '110px',
      cell: (t) => {
        const teamCodeStr = (t.teamCode as string) || 'N/A';
        const teamIdStr = (t.teamId || t._id) as string;
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isAdmin && teamIdStr) navigate(`/teams/${teamIdStr}/edit`);
            }}
            className="font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm hover:bg-emerald-500/20 cursor-pointer transition-colors"
            title="Edit Team"
          >
            {teamCodeStr}
          </button>
        );
      },
    },
    {
      id: 'name',
      header: 'Team Name & Description',
      cell: (t) => {
        const nameStr = (t.teamName as string) || '';
        const descStr = (t.description as string) || '';
        return (
          <div>
            <span className="font-semibold text-foreground text-sm leading-snug block">
              {nameStr}
            </span>
            {descStr ? (
              <span className="text-xs text-muted-foreground line-clamp-1 block">{descStr}</span>
            ) : (
              <span className="text-xs italic text-muted-foreground/50">No description</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'parentProject',
      header: 'Parent Project',
      width: '180px',
      cell: (t) => {
        const pObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
        const pName = pObj ? ((pObj.projectName || pObj.name) as string) : 'Unassigned';
        return <span className="text-xs font-medium text-foreground">{pName}</span>;
      },
    },
    {
      id: 'roster',
      header: 'Team Roster',
      width: '140px',
      cell: (t) => {
        const hostsArr = (t.hosts as unknown[]) || [];
        const membersArr = (t.members as unknown[]) || [];
        const rawList = [...hostsArr, ...membersArr];

        const memberList: Member[] = rawList.map((m) => {
          if (typeof m === 'string') {
            return { userId: m, userName: m, userEmail: '', userRole: 'Member', userStatus: 'ACTIVE', createdAt: '' };
          }
          const obj = m as Record<string, unknown>;
          return {
            userId: (obj.userId || obj._id || obj.id || '') as string,
            userName: (obj.userName || obj.name || obj.userEmail || '') as string,
            userEmail: (obj.userEmail || obj.email || '') as string,
            userRole: ((obj.userRole || obj.role || 'Member') as MemberRole),
            userStatus: ((obj.userStatus || obj.status || 'ACTIVE') as MemberStatus),
            jobTitle: obj.jobTitle as string | undefined,
            createdAt: (obj.createdAt || '') as string,
          };
        });

        const valueMap: Record<string, 'Host' | 'Member'> = {};
        hostsArr.forEach((h) => {
          const id = typeof h === 'string' ? h : ((h as Record<string, string>).userId || (h as Record<string, string>)._id);
          if (id) valueMap[id] = 'Host';
        });
        membersArr.forEach((m) => {
          const id = typeof m === 'string' ? m : ((m as Record<string, string>).userId || (m as Record<string, string>)._id);
          if (id && !valueMap[id]) valueMap[id] = 'Member';
        });

        const pObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
        const pName = pObj ? ((pObj.projectName || pObj.name) as string) : undefined;
        const tName = (t.teamName as string) || 'Team';

        return (
          <GroupedAvatars
            members={memberList}
            onClick={() => {
              setRosterModal({
                open: true,
                title: `Team Roster: ${tName}`,
                teamName: tName,
                projectName: pName,
                members: memberList,
                value: valueMap,
              });
            }}
          />
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      cell: (t) => {
        const teamStatusStr = (t.teamStatus as string) || 'active';
        return <Badge tone={getProjectStatusTone(teamStatusStr)}>{teamStatusStr}</Badge>;
      },
    },
    {
      id: 'createdAt',
      header: 'Created At',
      width: '120px',
      cell: (t) => (
        <span className="text-xs text-muted-foreground font-mono">
          {t.createdAt ? new Date(t.createdAt as string).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      width: '100px',
      cell: (t) => {
        const teamIdStr = (t.teamId || t._id) as string;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/teams/${teamIdStr}/edit`)}
                className="h-8 w-8 p-0"
                title="Edit Team"
              >
                <Edit2 size={14} />
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(teamIdStr)}
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                title="Delete Team"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
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
            <Select
              value={selectedProjectFilter}
              onValueChange={(val) => {
                if (val) {
                  setSelectedProjectFilter(String(val));
                  setCurrentPage(1);
                }
              }}
            >
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="All Projects">
                  {(val: unknown) => {
                    if (val === 'ALL' || !val) return 'All Projects';
                    const match = projects.find((p) => getProjectId(p) === val);
                    return match ? getProjectName(match) : String(val);
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Projects</SelectItem>
                {projects.map((p) => {
                  const pId = getProjectId(p);
                  const pName = getProjectName(p);
                  return (
                    <SelectItem key={pId} value={pId}>
                      {pName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
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
