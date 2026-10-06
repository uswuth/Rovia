import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FolderGit2,
  Users,
  Video,
  CheckSquare,
  FolderPlus,
  Edit,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import {
  getProjectName,
  getProjectCode,
  getProjectDesc,
  getProjectStatus,
  getProjectId,
  type Project,
} from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/Pagination';
import { getProjectStatusTone } from '@/lib/status-tone';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings } from '@/api/meeting/meeting.api';
import type { Meeting } from '@/api/meeting/meeting.types';

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentTab = searchParams.get('status') || 'ALL';
  const { projects, loading } = useProject();
  const { isAuthenticated } = useAuth();
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [gridPage, setGridPage] = useState(1);
  const [gridPageSize, setGridPageSize] = useState(6);

  // Fetch all meetings to accurately count meetings per project
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

  const columns: Column<Project>[] = [
    {
      id: 'code',
      header: 'Code',
      width: '110px',
      cell: (project) => {
        const pCode = getProjectCode(project);
        const pId = getProjectId(project);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (pId) navigate(`/projects/${pId}/edit`);
            }}
            className="font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm hover:bg-emerald-500/20 cursor-pointer transition-colors"
            title="Edit project"
          >
            {pCode}
          </button>
        );
      },
    },
    {
      id: 'name',
      header: 'Project Name',
      width: '180px',
      cell: (project) => {
        const pName = getProjectName(project);
        return (
          <span className="font-semibold text-foreground text-sm leading-snug">
            {pName}
          </span>
        );
      },
    },
    {
      id: 'description',
      header: 'Description',
      cell: (project) => {
        const pDesc = getProjectDesc(project);
        return pDesc ? (
          <span className="text-xs text-muted-foreground line-clamp-2 block">
            {pDesc}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground/50">No description</span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      cell: (project) => {
        const pStatus = getProjectStatus(project);
        return <Badge tone={getProjectStatusTone(pStatus)}>{pStatus}</Badge>;
      },
    },
    {
      id: 'team',
      header: 'Team',
      width: '100px',
      cell: (project) => {
        const hostList = Array.isArray(project.hosts) ? project.hosts : [];
        const memberList = Array.isArray(project.members) ? project.members : [];
        const uniqueTeam = new Set([...hostList, ...memberList]);
        const teamCount =
          uniqueTeam.size > 0
            ? uniqueTeam.size
            : (project.memberCount || (hostList.length + memberList.length) || 1);
        return (
          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
            <Users size={13} className="text-muted-foreground" />
            <span>{teamCount}</span>
          </div>
        );
      },
    },
    {
      id: 'meetings',
      header: 'Meets',
      width: '100px',
      cell: (project) => {
        const pId = getProjectId(project);
        const projectMeetingsCount = (meetings || []).filter((m) => {
          const mProjId = m.projectId || (m as unknown as Record<string, string>).project;
          return mProjId === pId;
        }).length;
        const finalMeetingCount =
          projectMeetingsCount > 0 ? projectMeetingsCount : (project.meetingCount || 0);
        return (
          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
            <Video size={13} className="text-muted-foreground" />
            <span>{finalMeetingCount}</span>
          </div>
        );
      },
    },
    {
      id: 'tasks',
      header: 'Tasks',
      width: '100px',
      cell: (project) => {
        const finalTaskCount = project.taskCount || 0;
        return (
          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
            <CheckSquare size={13} className="text-muted-foreground" />
            <span>{finalTaskCount}</span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: '80px',
      cell: (project) => {
        const pId = getProjectId(project);
        const pCode = getProjectCode(project);
        const pStatus = getProjectStatus(project).toLowerCase();
        const isReadOnly = pStatus === 'completed' || pStatus === 'archived';

        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={isReadOnly}
              onClick={(e) => {
                e.stopPropagation();
                if (!isReadOnly) navigate(`/meetings/new?projectId=${pCode || pId}`);
              }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-500 hover:bg-secondary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={isReadOnly ? `Project is ${pStatus}. Re-activate status to Active to schedule meetings.` : 'Schedule meeting'}
            >
              <Video size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/projects/${pCode || pId}/edit`);
              }}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
              title="Edit project"
            >
              <Edit size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <FolderGit2 className="text-emerald-500 dark:text-emerald-400" size={24} />
            <span>{pageTitle}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your workspace projects, team members, and linked meetings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Table View"
            >
              <LayoutList size={13} />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
          </div>

          <Button
            onClick={() => navigate('/projects/new')}
            className="shadow-xs shrink-0 gap-2 cursor-pointer"
          >
            <FolderPlus size={15} />
            <span>Create Project</span>
          </Button>
        </div>
      </div>

      {/* Projects Content Area */}
      {loading ? (
        viewMode === 'table' ? (
          <DataTable
            columns={columns}
            data={[]}
            loading={true}
            loadingRowCount={4}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-44 w-full rounded-md" />
            ))}
          </div>
        )
      ) : filteredProjects.length === 0 ? (
        /* Empty State Card when no projects exist */
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
        /* Projects Table View */
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedGridProjects.map((project) => {
                const pId = getProjectId(project);
                const pName = getProjectName(project);
                const pCode = getProjectCode(project);
                const pDesc = getProjectDesc(project);
                const pStatus = getProjectStatus(project);

                const hostList = Array.isArray(project.hosts) ? project.hosts : [];
                const memberList = Array.isArray(project.members) ? project.members : [];
                const uniqueTeam = new Set([...hostList, ...memberList]);
                const teamCount =
                  uniqueTeam.size > 0
                    ? uniqueTeam.size
                    : (project.memberCount || (hostList.length + memberList.length) || 1);

                const projectMeetingsCount = (meetings || []).filter((m) => {
                  const mProjId = m.projectId || (m as unknown as Record<string, string>).project;
                  return mProjId === pId;
                }).length;
                const finalMeetingCount =
                  projectMeetingsCount > 0 ? projectMeetingsCount : (project.meetingCount || 0);

                const finalTaskCount = project.taskCount || 0;

                return (
                  <div
                    key={pId || pName}
                    className="group relative rounded-md border border-border bg-card text-card-foreground p-5 hover:border-emerald-500/40 transition-all shadow-xs space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
                            {pCode}
                          </span>
                          <Badge tone={getProjectStatusTone(pStatus)}>{pStatus}</Badge>
                        </div>

                        <div className="flex items-center gap-1">
                          {(() => {
                            const isReadOnly = pStatus.toLowerCase() === 'completed' || pStatus.toLowerCase() === 'archived';
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isReadOnly}
                                onClick={() => !isReadOnly && navigate(`/meetings/new?projectId=${pCode || pId}`)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-500 hover:bg-secondary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isReadOnly ? `Project is ${pStatus}. Re-activate status to Active to schedule meetings.` : 'Schedule meeting'}
                              >
                                <Video size={14} />
                              </Button>
                            );
                          })()}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/projects/${pCode || pId}/edit`)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                            title="Edit project"
                          >
                            <Edit size={14} />
                          </Button>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-foreground leading-snug">{pName}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {pDesc || 'No description provided for this project.'}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-border grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-secondary rounded-sm p-2">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <Users size={12} />
                          <span className="text-[10px]">Team</span>
                        </div>
                        <div className="font-bold text-foreground">{teamCount}</div>
                      </div>

                      <div className="bg-secondary rounded-sm p-2">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <Video size={12} />
                          <span className="text-[10px]">Meets</span>
                        </div>
                        <div className="font-bold text-foreground">{finalMeetingCount}</div>
                      </div>

                      <div className="bg-secondary rounded-sm p-2">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <CheckSquare size={12} />
                          <span className="text-[10px]">Tasks</span>
                        </div>
                        <div className="font-bold text-foreground">{finalTaskCount}</div>
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
              className="rounded-md border"
            />
          </div>
        );
      })()}
    </div>
  );
};

