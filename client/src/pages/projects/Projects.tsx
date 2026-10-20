import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Video,
  FolderPlus,
  Edit,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import {
  getProjectName,
  getProjectCode,
  getProjectDesc,
  getProjectStatus,
  getProjectId,
} from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { CommonTabs, type TabItem } from '@/components/ui/common-tabs';
import { Badge } from '@/components/ui/badge';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/Pagination';
import { getProjectStatusTone } from '@/lib/status-tone';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings } from '@/api/meeting/meeting.api';
import type { Meeting } from '@/api/meeting/meeting.types';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import { normalizeMemberList } from '@/components/members/member-utils';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { formatDate } from '@/lib/format-date';
import type { Member } from '@/types/member.types';
import { getProjectColumns, type ProjectRosterModalState } from './Projects.TanCol';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('status') || 'ALL';
  const { projects, loading } = useProject();
  const { user, isAuthenticated } = useAuth();
  const { members: orgMembers } = useOrganization();
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [gridPage, setGridPage] = useState(1);
  const [gridPageSize, setGridPageSize] = useState(6);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Record<string, boolean>>({});
  const [rosterModal, setRosterModal] = useState<ProjectRosterModalState | null>(null);

  // All meetings are fetched so the per-project meeting count is accurate.
  const { data: meetings } = useQuery<Meeting[]>(
    queryKeys.meetings.list(),
    () => getMeetings(),
    { enabled: isAuthenticated, list: true }
  );

  const filteredProjects = projects.filter((p) => {
    if (currentTab === 'ALL') return true;
    const status = getProjectStatus(p);
    return status.toLowerCase() === currentTab.toLowerCase();
  });

  const pageTitle =
    currentTab === 'ALL'
      ? 'Projects'
      : `Projects (${currentTab.charAt(0).toUpperCase() + currentTab.slice(1).toLowerCase()})`;

  const columns = useMemo(
    () =>
      getProjectColumns({
        navigate,
        meetings,
        onOpenRoster: setRosterModal,
        user,
      }),
    [navigate, meetings, setRosterModal, user]
  );

  return (
    <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FolderGit2 className="text-primary" size={24} />
            <span>{pageTitle}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your workspace projects, team members, and linked meetings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <CommonTabs
            items={[
              { id: 'cards', label: 'Cards', icon: <LayoutGrid size={13} /> },
              { id: 'table', label: 'Table', icon: <LayoutList size={13} /> },
            ]}
            value={viewMode}
            onChange={(val) => setViewMode(val as 'cards' | 'table')}
            size="xs"
          />

          <Button
            onClick={() => navigate('/projects/new')}
            className="shadow-xs shrink-0 gap-2 cursor-pointer"
          >
            <FolderPlus size={15} />
            <span>Create Project</span>
          </Button>
        </div>
      </div>

      {loading ? (
        viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={[]}
            loading={true}
            loadingRowCount={4}
          />
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-sm" />
            ))}
          </div>
        )
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={FolderPlus}
          title={currentTab === 'ALL' ? 'No projects created yet' : `No ${currentTab} projects found`}
          description={
            currentTab === 'ALL'
              ? 'Get started by creating your first workspace project to organize sprints, host team meetings, and assign deliverables.'
              : `There are currently no projects marked as '${currentTab}'. Create a new project to get started.`
          }
          actionLabel="Create New Project"
          onAction={() => navigate('/projects/new')}
          accentColor="emerald"
        />
      ) : viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={filteredProjects}
          keyExtractor={(p) => getProjectId(p) || getProjectName(p)}
        />
      ) : (() => {
        const gridTotalPages = Math.ceil(filteredProjects.length / gridPageSize) || 1;
        const paginatedGridProjects = filteredProjects.slice(
          (gridPage - 1) * gridPageSize,
          gridPage * gridPageSize
        );

        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {paginatedGridProjects.map((project) => {
                const pId = getProjectId(project);
                const pName = getProjectName(project);
                const pCode = getProjectCode(project);
                const pDesc = getProjectDesc(project);
                const pStatus = getProjectStatus(project);

                const isReadOnly = pStatus.toLowerCase() === 'completed' || pStatus.toLowerCase() === 'archived';
                const isGlobalAdmin = Boolean(
                  user?.isSuperAdmin || user?.userRole === 'SuperAdmin' || user?.userRole === 'Admin'
                );
                const isProjectHost = Boolean(
                  user?.userId &&
                  (project.hosts || []).some((h: unknown) => {
                    if (typeof h === 'string') return h === user.userId;
                    if (typeof h === 'object' && h !== null) {
                      const obj = h as Record<string, unknown>;
                      return (obj.userId || obj._id || obj.id) === user.userId;
                    }
                    return false;
                  })
                );
                const canSchedule = isGlobalAdmin || isProjectHost;

                // Member resolution with real orgMember names
                const hostsArr = (project.hosts || []) as (Member | string | Record<string, unknown>)[];
                const membersArr = (project.members || []) as (Member | string | Record<string, unknown>)[];

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

                // Lead/Host avatar for tooltip
                const leadMember = resolvedHosts[0] || combinedMembers[0];
                const leadName = leadMember?.userName || 'Project Lead';
                const leadRole = valueMap[leadMember?.userId || ''] || 'Host';
                const leadInitial = leadName.charAt(0).toUpperCase();
                const leadColor = getAvatarColorByName(leadName);

                const createdAtRaw = project.createdAt || project.updatedAt;
                const createdAtStr = createdAtRaw ? (formatDate(createdAtRaw, { includeTime: true }) || 'Recently') : 'Recently';

                const isExpanded = Boolean(expandedProjectIds[pId || pName]);
                const descLength = pDesc.trim().length;
                const hasLongDescription = descLength > 120;

                const projectMeetingsCount = (meetings || []).filter((m) => {
                  const mProjId = m.projectId || (m as unknown as Record<string, string>).project;
                  return mProjId === pId;
                }).length;
                const finalMeetingCount =
                  projectMeetingsCount > 0 ? projectMeetingsCount : (project.meetingCount || 0);

                return (
                  <div
                    key={pId || pName}
                    className="group rounded-sm border border-border bg-card hover:border-primary/40 p-4 transition-all space-y-3 shadow-xs"
                  >
                    {/* Top Header Row: Project Name on left; Status + Action Buttons + Lead Avatar at far right end */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-snug truncate block">
                          {pName}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge tone={getProjectStatusTone(pStatus)} className="text-[10px] capitalize">
                          {pStatus}
                        </Badge>

                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isReadOnly || !canSchedule}
                            onClick={() => !isReadOnly && canSchedule && navigate(`/meetings/new?projectId=${pCode || pId}`)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-secondary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={
                              !canSchedule
                                ? 'Only project hosts, Admins, or SuperAdmins can schedule meetings'
                                : isReadOnly
                                  ? `Project is ${pStatus}. Re-activate status to Active to schedule meetings.`
                                  : 'Schedule meeting'
                            }
                          >
                            <Video size={13} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/projects/${pCode || pId}/edit`)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Edit project"
                          >
                            <Edit size={12} />
                          </Button>
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

                    {/* Description Row: Description on left (max-w-2xl) with responsive inline toggle */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className={`w-full max-w-2xl ${isExpanded ? 'py-0.5' : 'h-8 min-h-[2rem] flex items-center'}`}>
                        {pDesc ? (
                          <p className={`text-xs text-muted-foreground leading-relaxed transition-all ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                            {pDesc}
                            {hasLongDescription && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedProjectIds((prev) => ({
                                    ...prev,
                                    [pId || pName]: !prev[pId || pName],
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
                            No description provided for this project.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: CodeBadge & Meeting count on left, Grouped Avatars on right */}
                    <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/20">
                      <div className="flex flex-wrap items-center gap-2 min-w-0 text-xs text-muted-foreground">
                        <CodeBadge
                          code={pCode}
                          onClick={() => {
                            if (pId) navigate(`/projects/${pId}/edit`);
                          }}
                          title="Edit Project"
                        />

                        {finalMeetingCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-muted/60 border border-border/80 text-foreground text-xs font-mono">
                            <Video size={11} className="text-primary shrink-0" />
                            <span>{finalMeetingCount} {finalMeetingCount === 1 ? 'meet' : 'meets'}</span>
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
                                title: `${pName} — Project Roster`,
                                members: combinedMembers,
                                projectName: pName,
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
              currentPage={gridPage}
              totalPages={gridTotalPages}
              totalItems={filteredProjects.length}
              pageSize={gridPageSize}
              pageSizeOptions={[6, 12, 24, 48]}
              onPageChange={setGridPage}
              onPageSizeChange={(newSize) => {
                setGridPageSize(newSize);
                setGridPage(1);
              }}
              className="rounded-sm border"
            />
          </div>
        );
      })()}

      {rosterModal && (
        <RosterDetailModal
          open={rosterModal.open}
          onClose={() => setRosterModal(null)}
          title={rosterModal.title}
          projectName={rosterModal.projectName}
          members={rosterModal.members}
          value={rosterModal.value}
        />
      )}
    </div>
  );
};


