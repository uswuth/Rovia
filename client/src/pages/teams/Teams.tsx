import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, LayoutGrid, Table2, Edit2, Trash2, FolderGit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommonTabs, type TabItem } from '@/components/ui/common-tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { deleteTeamApi } from '@/api/teams/teams.api';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTeams } from '@/hooks/useTeams';
import { useProjects } from '@/hooks/useProjects';
import { useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useDebounce } from '@/hooks/useDebounce';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { getTeamColumns, type TeamRosterModalState } from './Teams.TanCol';
import { normalizeMemberList } from '@/components/members/member-utils';
import type { Member } from '@/types/member.types';
import { getProjectStatusTone } from '@/lib/status-tone';
import { formatDate } from '@/lib/format-date';

export const Teams: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members: orgMembers } = useOrganization();
  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');

  const { teams, loading: teamsLoading } = useTeams();
  const { projects, loading: projectsLoading } = useProjects();
  const VIEW_MODE_TABS: TabItem[] = [
    { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
    { id: 'table', label: 'Table', icon: <Table2 size={13} /> },
  ];
  const loading = teamsLoading || (projectsLoading && projects.length === 0);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedTeamIds, setExpandedTeamIds] = useState<Record<string, boolean>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
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
        <Skeleton className="h-96 w-full rounded-sm" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="w-full space-y-6">
        { }
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <Users size={24} className="text-primary" />
              <span>Teams</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Manage your workspace project sub-teams, lead assignments, and team rosters.
            </p>
          </div>

          <div className="flex items-center gap-3">
                      {/* View Mode Toggle: Cards vs Table */}
                      <CommonTabs
                        items={VIEW_MODE_TABS}
                        value={viewMode}
                        onChange={(val) => setViewMode(val as 'cards' | 'table')}
                        size="xs"
                      />

                      {isAdmin && (
                        <Button onClick={() => navigate('/teams/new')} className="gap-2 cursor-pointer bg-cyan-500 hover:bg-cyan-400 transition-colors text-white">
                          <Plus size={16} />
                          <span>Create Team</span>
                        </Button>
                      )}
                    </div>
        </div>

        { }
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

        { }
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
        ) : viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={filteredTeams}
            keyExtractor={(t) => (t.teamId || t._id || t.teamCode || '') as string}
            page={currentPage}
            pageSize={pageSize}
            pageSizeOptions={[6, 12, 24, 48]}
            totalCount={totalItems}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              {filteredTeams
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((t) => {
                  const teamIdStr = (t.teamId || t._id) as string;
                  const teamCodeStr = (t.teamCode as string) || 'TEM-N/A';
                  const teamNameStr = (t.teamName as string) || 'Unnamed Team';
                  const teamDescStr = (t.description as string) || '';
                  const teamStatusStr = ((t.teamStatus as string) || 'active').toLowerCase();

                  // Project resolution
                  const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
                  const projId = projObj ? ((projObj.projectId || projObj._id) as string) : (t.projectId as string);
                  const matchedProject = projects.find((p) => getProjectId(p) === projId);
                  const projName = (matchedProject ? getProjectName(matchedProject) : null) || (projObj ? ((projObj.projectName || projObj.name) as string) : null);
                  const projCode = matchedProject ? getProjectCode(matchedProject) : null;

                  // Member resolution with real orgMember names
                  const hostsArr = (t.hosts || []) as (Member | string | Record<string, unknown>)[];
                  const membersArr = (t.members || []) as (Member | string | Record<string, unknown>)[];

                  const resolveMember = (item: Member | string | Record<string, unknown>, defaultRole: 'Host' | 'Member'): Member => {
                    let id = '';
                    let rawName = '';
                    let rawEmail = '';
                    let rawAvatar = '';
                    let rawRole = defaultRole;

                    if (typeof item === 'string') {
                      id = item;
                    } else if (typeof item === 'object' && item !== null) {
                      const obj = item as Record<string, unknown>;
                      id = String(obj.userId || obj._id || obj.id || '');
                      rawName = String(obj.userName || obj.name || '');
                      rawEmail = String(obj.userEmail || obj.email || '');
                      rawAvatar = String(obj.avatarUrl || obj.avatar || '');
                      if (obj.userRole) rawRole = String(obj.userRole) as 'Host' | 'Member';
                    }

                    const matchedOrgMember = (orgMembers || []).find(
                      (om) => (id && om.userId === id) || (rawEmail && om.userEmail?.toLowerCase() === rawEmail.toLowerCase())
                    );

                    const finalName =
                      matchedOrgMember?.userName && !matchedOrgMember.userName.toLowerCase().startsWith('user')
                        ? matchedOrgMember.userName
                        : rawName && !rawName.toLowerCase().startsWith('user')
                          ? rawName
                          : matchedOrgMember?.userEmail
                            ? matchedOrgMember.userEmail.split('@')[0]
                            : rawEmail
                              ? rawEmail.split('@')[0]
                              : `${defaultRole}`;

                    return {
                      userId: id || finalName,
                      userName: finalName,
                      userEmail: matchedOrgMember?.userEmail || rawEmail,
                      userRole: (matchedOrgMember?.userRole || rawRole) as Member['userRole'],
                      userStatus: 'ACTIVE',
                      avatarUrl: matchedOrgMember?.avatarUrl || rawAvatar || undefined,
                    };
                  };

                  const resolvedHosts = hostsArr.map((h) => resolveMember(h, 'Host'));
                  const resolvedMembers = membersArr.map((m) => resolveMember(m, 'Member'));
                  const combinedMembers = normalizeMemberList([...resolvedHosts, ...resolvedMembers]);

                  const valueMap: Record<string, 'Host' | 'Member'> = {};
                  resolvedHosts.forEach((h) => {
                    if (h.userId) valueMap[h.userId] = 'Host';
                  });
                  resolvedMembers.forEach((m) => {
                    if (m.userId && !valueMap[m.userId]) valueMap[m.userId] = 'Member';
                  });

                  // Creator / Lead for tooltip
                  const leadMember = resolvedHosts[0] || combinedMembers[0];
                  const leadName = leadMember?.userName || 'Team Lead';
                  const leadRole = valueMap[leadMember?.userId || ''] || 'Host';
                  const leadInitial = leadName.charAt(0).toUpperCase();
                  const leadColor = getAvatarColorByName(leadName);

                  const createdAtRaw = (t.createdAt as string) || (t.updatedAt as string);
                  const createdAtStr = createdAtRaw ? (formatDate(createdAtRaw, { includeTime: true }) || 'Recently') : 'Recently';

                  const isExpanded = Boolean(expandedTeamIds[teamIdStr]);
                  const descLength = teamDescStr.trim().length;
                  const hasLongDescription = descLength > 120;

                  return (
                    <div
                      key={teamIdStr}
                      className="group rounded-sm border border-border bg-card hover:border-primary/40 p-4 transition-all space-y-3 shadow-xs"
                    >
                      {/* Top Header Row: Name on left; Status + Lead Avatar + Edit/Delete on right */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-snug truncate block">
                            {teamNameStr}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge tone={getProjectStatusTone(teamStatusStr)} className="text-[10px] capitalize">
                            {teamStatusStr}
                          </Badge>

                          <div className="flex items-center gap-0.5">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/teams/${teamIdStr}/edit`)}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Edit Team"
                              >
                                <Edit2 size={12} />
                              </Button>
                            )}
                            {isSuperAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(teamIdStr)}
                                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10 cursor-pointer"
                                title="Delete Team"
                              >
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </div>

                          <Tooltip className="w-auto">
                            <TooltipTrigger asChild>
                              <div
                                className={`size-6 rounded-full flex items-center justify-center font-bold text-[10px] ${leadColor} shrink-0 shadow-xs cursor-pointer ring-1 ring-border/60 hover:ring-primary/60 transition-all ml-0.5`}
                              >
                                {leadInitial}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="end"
                              className="p-2 space-y-1 text-left min-w-[150px] bg-popover text-popover-foreground border border-border shadow-md rounded-sm z-50"
                            >
                              <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                <span>{leadName}</span>
                                <span className="text-[10px] font-normal px-1 py-0.2 rounded-xs bg-primary/15 text-primary border border-primary/20">
                                  {leadRole}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                Created at: <span className="text-foreground">{createdAtStr}</span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      {/* Description Row: Description on left (max-w-2xl) with responsive toggle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className={`w-full max-w-2xl ${isExpanded ? 'py-0.5' : 'h-8 min-h-[2rem] flex items-center'}`}>
                          {teamDescStr ? (
                            <p className={`text-xs text-muted-foreground leading-relaxed transition-all ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                              {teamDescStr}
                              {hasLongDescription && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedTeamIds((prev) => ({
                                      ...prev,
                                      [teamIdStr]: !prev[teamIdStr],
                                    }));
                                  }}
                                  className="ml-1.5 text-primary hover:underline font-semibold inline-flex items-center cursor-pointer"
                                >
                                  {isExpanded ? 'less' : 'more...'}
                                </button>
                              )}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground/50 italic">
                              No description provided for this team.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Team Code + Project badge on left, Grouped Avatars on right */}
                      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/20">
                        <div className="flex flex-wrap items-center gap-2 min-w-0 text-xs text-muted-foreground">
                          <CodeBadge
                            code={teamCodeStr}
                            onClick={isAdmin && teamIdStr ? () => navigate(`/teams/${teamIdStr}/edit`) : undefined}
                            title={isAdmin && teamIdStr ? 'Edit Team' : undefined}
                          />

                          {projName && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-muted/60 border border-border/80 text-foreground font-mono text-xs max-w-[170px] truncate">
                              <FolderGit2 size={11} className="text-primary shrink-0" />
                              <span className="truncate">{projCode || projName}</span>
                            </span>
                          )}
                        </div>

                        <div className="shrink-0">
                          {combinedMembers.length > 0 && (
                            <GroupedAvatars
                              members={combinedMembers}
                              maxDisplay={4}
                              size="xs"
                              onClick={() => {
                                setRosterModal({
                                  open: true,
                                  title: `${teamNameStr} — Team Roster`,
                                  members: combinedMembers,
                                  projectName: projName || undefined,
                                  teamName: teamNameStr,
                                  value: valueMap,
                                });
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalItems / pageSize) || 1}
              totalItems={totalItems}
              pageSize={pageSize}
              pageSizeOptions={[6, 12, 24, 48]}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setCurrentPage(1);
              }}
              className="rounded-sm border"
            />
          </div>
        )}

        { }
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

