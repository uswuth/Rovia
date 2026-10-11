import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  RefreshCw,
  LayoutGrid,
  List,
  GripVertical,
  FolderGit2,
  Users,
} from 'lucide-react';
import { getTasksApi, updateTaskApi, deleteTaskApi, type TaskStatusType } from '@/api/tasks/tasks.api';
import { getTeamsApi } from '@/api/teams/teams.api';
import { useAuth } from '@/context/AuthContext';
import { useProject } from '@/context/ProjectContext';
import { useOrganization } from '@/context/OrganizationContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

import { extractApiItems } from '@/utils/apiResponse';
import { cn } from '@/lib/utils';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/useDebounce';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';
import { getTaskColumns, KANBAN_COLUMNS } from './Tasks.TanCol';

const formatTaskDate = (dateVal?: unknown) => {
  if (!dateVal || (typeof dateVal !== 'string' && typeof dateVal !== 'number' && !(dateVal instanceof Date))) return null;
  const d = new Date(dateVal as string);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const mapTaskMembers = (
  assignedArr: unknown[],
  orgMembers?: Member[],
  currentUser?: { userId?: string; userName?: string; userEmail?: string; userRole?: string; avatarUrl?: string } | null
): Member[] => {
  return assignedArr.map((m) => {
    if (typeof m === 'string') {
      const match = orgMembers?.find((om) => om.userId === m || om.userName === m);
      return {
        userId: m,
        userName: match?.userName || m,
        userEmail: match?.userEmail || '',
        userRole: (match?.userRole || 'Member') as MemberRole,
        userStatus: (match?.userStatus || 'ACTIVE') as MemberStatus,
        avatarUrl: match?.avatarUrl,
        createdAt: match?.createdAt || '',
      };
    }
    const obj = m as Record<string, unknown>;
    const uid = (obj.userId || obj._id || obj.id || '') as string;
    const uEmail = (obj.userEmail || obj.email || '') as string;
    const match =
      orgMembers?.find((om) => (uid && om.userId === uid) || (uEmail && om.userEmail === uEmail)) ||
      (currentUser && (currentUser.userId === uid || (uEmail && currentUser.userEmail === uEmail))
        ? {
            userId: currentUser.userId || uid,
            userName: currentUser.userName || (obj.userName as string) || '',
            userEmail: currentUser.userEmail || uEmail,
            userRole: (currentUser.userRole as MemberRole) || 'Member',
            userStatus: 'ACTIVE' as MemberStatus,
            avatarUrl: currentUser.avatarUrl,
            createdAt: '',
          }
        : null);

    return {
      userId: uid,
      userName: match?.userName || (obj.userName as string) || (obj.name as string) || (obj.userEmail as string) || '',
      userEmail: match?.userEmail || uEmail,
      userRole: (match?.userRole || obj.userRole || obj.role || 'Member') as MemberRole,
      userStatus: (match?.userStatus || obj.userStatus || obj.status || 'ACTIVE') as MemberStatus,
      userCode: obj.userCode as string | undefined,
      avatarUrl: match?.avatarUrl || (obj.avatarUrl as string | undefined),
      jobTitle: obj.jobTitle as string | undefined,
      createdAt: (obj.createdAt || '') as string,
    };
  });
};

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members: orgMembers } = useOrganization();
  const { projects: contextProjects } = useProject();
  const hasFetchedRef = useRef(false);

  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');
  const isHost = Boolean(isAdmin || (user?.userRole as string) === 'Host');
  const canManage = isHost;

  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const [rosterModal, setRosterModal] = useState<{
    open: boolean;
    title: string;
    members: Member[];
  } | null>(null);

  const projects = useMemo(() => {
    return (contextProjects || []) as unknown as Record<string, unknown>[];
  }, [contextProjects]);

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [teamFilter, setTeamFilter] = useState('ALL');

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<TaskStatusType | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const loadData = async () => {
    try {
      setLoading(true);
      const [tRes, tmRes] = await Promise.all([
        getTasksApi(),
        getTeamsApi(),
      ]);
      const rawTasks = extractApiItems(tRes);
      const rawTeams = extractApiItems(tmRes);
      setTasks(rawTasks as unknown as Record<string, unknown>[]);
      setTeams(rawTeams as unknown as Record<string, unknown>[]);
    } catch (err) {
      console.error(err);
      setTasks([]);
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    void loadData();
  }, []);

  const handleDelete = useCallback(async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this Task?')) return;
    setTasks((prev) => prev.filter((t) => ((t.taskId || t._id) as string) !== taskId));
    try {
      await deleteTaskApi(taskId);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to delete task.');
      void loadData();
    }
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatusType) => {
    const currentTask = tasks.find((t) => ((t.taskId || t._id) as string) === taskId);
    if (!currentTask || (currentTask.taskStatus as TaskStatusType) === newStatus) {
      return;
    }

    const previousStatus = currentTask.taskStatus as TaskStatusType;

    // 1. Optimistically update local tasks state immediately (0ms UI re-render, zero extra fetches)
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        const idStr = (t.taskId || t._id) as string;
        if (idStr === taskId) {
          return { ...t, taskStatus: newStatus };
        }
        return t;
      })
    );

    // 2. Perform single background API call
    try {
      await updateTaskApi(taskId, { taskStatus: newStatus });
    } catch (err: unknown) {
      // Revert optimistic update on error
      setTasks((prevTasks) =>
        prevTasks.map((t) => {
          const idStr = (t.taskId || t._id) as string;
          if (idStr === taskId) {
            return { ...t, taskStatus: previousStatus };
          }
          return t;
        })
      );
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to update task status.');
    }
  };

  const filteredTasks = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    return tasks
      .filter((t) => {
        const titleStr = (t.taskTitle as string) || '';
        const descStr = (t.taskDescription as string) || '';
        const matchesSearch =
          !query ||
          titleStr.toLowerCase().includes(query) ||
          descStr.toLowerCase().includes(query);

        const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
        const projId = projObj ? ((projObj.projectId || projObj._id) as string) : (t.projectId as string);
        const matchesProj = projectFilter === 'ALL' || projId === projectFilter;

        const teamObj = typeof t.teamId === 'object' && t.teamId !== null ? (t.teamId as Record<string, unknown>) : null;
        const tmId = teamObj ? ((teamObj.teamId || teamObj._id) as string) : (t.teamId as string);
        const matchesTeam = teamFilter === 'ALL' || tmId === teamFilter;

        return matchesSearch && matchesProj && matchesTeam;
      })
      .sort((a, b) => {
        const timeA = new Date((a.createdAt || a.created_at || 0) as string).getTime() || 0;
        const timeB = new Date((b.createdAt || b.created_at || 0) as string).getTime() || 0;
        return timeB - timeA;
      });
  }, [tasks, debouncedSearch, projectFilter, teamFilter]);

  const projectFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: 'ALL', label: 'All Projects' },
      ...projects.map((p) => {
        const pId = (p.projectId || p._id || p.id) as string;
        const pName = ((p.projectName || p.name || p.title) as string) || 'Unnamed Project';
        return {
          value: pId,
          label: pName,
        };
      }),
    ];
  }, [projects]);

  const teamFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: 'ALL', label: 'All Teams' },
      ...teams.map((tm) => {
        const tmId = (tm.teamId || tm._id) as string;
        const tmName = ((tm.teamName || tm.name) as string) || 'Unnamed Team';
        return {
          value: tmId,
          label: tmName,
        };
      }),
    ];
  }, [teams]);

  const columns = useMemo(
    () =>
      getTaskColumns({
        navigate,
        isAdmin,
        canManage,
        onDelete: handleDelete,
        onOpenAssigneesModal: (taskTitle, members) => {
          setRosterModal({
            open: true,
            title: `Task Assignees: ${taskTitle}`,
            members,
          });
        },
      }),
    [navigate, isAdmin, canManage, handleDelete, setRosterModal]
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
    <div className="w-full max-w-full min-w-0 flex-1 flex flex-col bg-background text-foreground p-6 lg:p-8 space-y-6 min-h-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <CheckSquare className="text-emerald-500 dark:text-emerald-400" size={24} />
            <span>Tasks & Board</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Project and team level task tracking with Table and interactive Kanban Board views.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${viewMode === 'kanban'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <LayoutGrid size={13} />
              <span>Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${viewMode === 'table'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <List size={13} />
              <span>Table</span>
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="h-9 px-3 gap-1.5 cursor-pointer"
            title="Refresh Tasks"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>

          {canManage && (
            <Button
              onClick={() => navigate('/tasks/new')}
              className="h-9 shadow-xs shrink-0 gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>Create Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="text"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-64 h-9 text-xs"
          />

          <div className="w-full sm:w-48">
            <SearchableSelect
              value={projectFilter}
              onChange={(val) => {
                setProjectFilter(val || 'ALL');
                setCurrentPage(1);
              }}
              options={projectFilterOptions}
              placeholder="All Projects"
              searchPlaceholder="Search projects..."
              className="w-full text-xs"
            />
          </div>

          <div className="w-full sm:w-48">
            <SearchableSelect
              value={teamFilter}
              onChange={(val) => {
                setTeamFilter(val || 'ALL');
                setCurrentPage(1);
              }}
              options={teamFilterOptions}
              placeholder="All Teams"
              searchPlaceholder="Search teams..."
              className="w-full text-xs"
            />
          </div>
        </div>
      </div>

      {/* Content Area: Kanban or Table */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description={
            search || projectFilter !== 'ALL' || teamFilter !== 'ALL'
              ? 'Try adjusting your search query or filters.'
              : 'Get started by creating a new task to organize deliverables.'
          }
          actionLabel={canManage && projectFilter === 'ALL' && teamFilter === 'ALL' && !search ? 'Create Task' : undefined}
          onAction={canManage && projectFilter === 'ALL' && teamFilter === 'ALL' && !search ? () => navigate('/tasks/new') : undefined}
        />
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW WITH INTERACTIVE DRAG & DROP */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 flex-1 min-h-0 overflow-x-auto pb-4">
          {KANBAN_COLUMNS.map((col) => {
            const Icon = col.icon;
            const columnTasks = filteredTasks.filter((t) => (t.taskStatus as string) === col.id);

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverColumnId !== col.id) setDragOverColumnId(col.id);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverColumnId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
                  if (taskId) {
                    void handleStatusChange(taskId, col.id);
                  }
                  setDraggedTaskId(null);
                  setDragOverColumnId(null);
                }}
                className="flex flex-col flex-1 min-h-[500px] lg:min-h-0 space-y-3"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', col.iconColor)} />
                    <span className="text-xs font-bold text-foreground tracking-tight">{col.label}</span>
                    <span className="text-xs font-mono font-medium text-muted-foreground/80">{columnTasks.length}</span>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => navigate('/tasks/new')}
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                        title="Create Task"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {columnTasks.length === 0 ? (
                    <div className="h-28 border border-dashed border-border/50 rounded-sm flex items-center justify-center text-xs text-muted-foreground/50 italic">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const taskIdStr = (task.taskId || task._id) as string;
                      const taskCodeStr = ((task.taskCode || task.task_code || taskIdStr) as string) || '';
                      const taskTitleStr = (task.taskTitle as string) || '';
                      const taskDescStr = (task.taskDescription as string) || '';
                      const assignedArr = (task.assignedMembers as unknown[]) || [];
                      const mappedMembers = mapTaskMembers(assignedArr, orgMembers, user);
                      const isBeingDragged = draggedTaskId === taskIdStr;

                      const projObj = typeof task.projectId === 'object' && task.projectId !== null ? (task.projectId as Record<string, unknown>) : null;
                      const teamObj = typeof task.teamId === 'object' && task.teamId !== null ? (task.teamId as Record<string, unknown>) : null;
                      const projName = projObj ? ((projObj.projectName || projObj.name) as string) : (typeof task.projectId === 'string' ? task.projectId : null);
                      const teamName = teamObj ? (teamObj.teamName as string) : null;

                      const cObj = typeof task.createdBy === 'object' && task.createdBy !== null ? (task.createdBy as Record<string, unknown>) : null;
                      const creatorId = cObj ? ((cObj.userId || cObj._id || cObj.id) as string) : (typeof task.createdBy === 'string' ? task.createdBy : '');
                      const liveCreator =
                        orgMembers?.find((m) => (creatorId && m.userId === creatorId) || (m.userEmail && cObj && m.userEmail === cObj.userEmail)) ||
                        (user && ((creatorId && user.userId === creatorId) || (cObj && user.userEmail === cObj.userEmail))
                          ? {
                              userId: user.userId,
                              userName: user.userName,
                              userEmail: user.userEmail,
                              userRole: user.userRole,
                              avatarUrl: user.avatarUrl,
                            }
                          : null);

                      const creatorName =
                        liveCreator?.userName || (cObj ? ((cObj.userName || cObj.name || cObj.userEmail) as string) : (typeof task.createdBy === 'string' ? task.createdBy : null));
                      const creatorRole = liveCreator?.userRole || (cObj ? ((cObj.userRole || cObj.role || 'Member') as string) : 'Member');
                      const creatorAvatar = liveCreator?.avatarUrl || (cObj ? (cObj.avatarUrl as string) : undefined);
                      const createdAtStr = formatTaskDate(task.createdAt || task.created_at);
                      const updatedAtStr = formatTaskDate(task.updatedAt || task.updated_at);

                      return (
                        <div
                          key={taskIdStr}
                          draggable={canManage}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', taskIdStr);
                            setDraggedTaskId(taskIdStr);
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverColumnId(null);
                          }}
                          className={cn(
                            'rounded-sm border border-border/80 bg-card p-3 hover:border-border transition-all duration-150 space-y-2 group shadow-2xs select-none min-w-0 max-w-full relative hover:z-20',
                            canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                            isBeingDragged ? 'opacity-25 border-dashed shadow-none' : ''
                          )}
                        >
                          {/* Top row: Drag Handle + Clickable Task Title & Top-Right Assigner Avatar */}
                          <div className="flex items-center justify-between gap-1.5 text-xs min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {canManage && (
                                <GripVertical
                                  size={13}
                                  className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing transition-colors"
                                />
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/tasks/${taskCodeStr}`);
                                }}
                                className="font-semibold text-xs text-foreground hover:text-emerald-500 hover:underline leading-snug truncate text-left cursor-pointer flex-1"
                                title={`View task: ${taskTitleStr}`}
                              >
                                {taskTitleStr}
                              </button>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Assigner / Creator avatar alone with rich info tooltip */}
                              {creatorName && (
                                <Tooltip className="w-auto">
                                  <TooltipTrigger asChild>
                                    <div className="cursor-pointer">
                                      <Avatar className="size-5 text-[9px] shrink-0 ring-1 ring-border/70 shadow-2xs">
                                        {creatorAvatar && <AvatarImage src={creatorAvatar} alt={creatorName} />}
                                        <AvatarFallback name={creatorName} className="text-[9px] font-bold">
                                          {creatorName.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" align="start" className="p-2.5 space-y-1.5 text-left min-w-[160px] bg-popover text-popover-foreground border border-border shadow-md rounded-md z-50">
                                    <div className="flex items-center gap-2">
                                      <Avatar className="size-6 text-[10px]">
                                        {creatorAvatar && <AvatarImage src={creatorAvatar} alt={creatorName} />}
                                        <AvatarFallback name={creatorName} className="font-bold">
                                          {creatorName.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-xs text-foreground truncate">{creatorName}</p>
                                        <p className="text-[10px] text-muted-foreground">{creatorRole}</p>
                                      </div>
                                    </div>
                                    <div className="border-t border-border/50 pt-1.5 text-[10px] space-y-0.5 text-muted-foreground">
                                      {createdAtStr && (
                                        <p className="flex items-center justify-between gap-2">
                                          <span>Created:</span>
                                          <span className="font-mono text-foreground/80">{createdAtStr}</span>
                                        </p>
                                      )}
                                      {updatedAtStr && updatedAtStr !== createdAtStr && (
                                        <p className="flex items-center justify-between gap-2">
                                          <span>Updated:</span>
                                          <span className="font-mono text-foreground/80">{updatedAtStr}</span>
                                        </p>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>

                          {/* Middle: Description with "...more" link to view page (2.5 lines + inline more) or No description fallback */}
                          {taskDescStr ? (
                            <div className="text-[11px] text-muted-foreground leading-relaxed break-words [overflow-wrap:anywhere] break-all min-w-0 max-w-full overflow-hidden">
                              {taskDescStr.length <= 110 ? (
                                <span className="break-words [overflow-wrap:anywhere] break-all line-clamp-3 block">
                                  {taskDescStr}
                                </span>
                              ) : (
                                <div className="break-words [overflow-wrap:anywhere] break-all leading-normal">
                                  <span>{taskDescStr.slice(0, 100)}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/tasks/${taskCodeStr}`);
                                    }}
                                    className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer ml-1 whitespace-nowrap"
                                  >
                                    ...more
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/50 italic">No description</p>
                          )}

                          {/* Card Footer: Project / Team Badges in same single row & Assignees Avatar Group */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px] gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                              {projName && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-secondary text-secondary-foreground text-[10px] font-medium border border-border/50 truncate shrink-0 max-w-[85px]" title={projName}>
                                  <FolderGit2 size={10} className="text-emerald-500 shrink-0" />
                                  <span className="truncate">{projName}</span>
                                </span>
                              )}
                              {teamName && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-medium border border-blue-500/20 truncate shrink-0 max-w-[80px]" title={teamName}>
                                  <Users size={10} className="shrink-0" />
                                  <span className="truncate">{teamName}</span>
                                </span>
                              )}
                            </div>

                            <div className="shrink-0">
                              <GroupedAvatars
                                members={mappedMembers}
                                maxDisplay={3}
                                size="xs"
                                onClick={() => {
                                  if (mappedMembers.length > 0) {
                                    setRosterModal({
                                      open: true,
                                      title: `Task Assignees: ${taskTitleStr}`,
                                      members: mappedMembers,
                                    });
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW USING DATA TABLE */
        <DataTable
          columns={columns}
          data={filteredTasks}
          keyExtractor={(t) => (t.taskId || t._id || t.taskCode || '') as string}
          page={currentPage}
          pageSize={pageSize}
          totalCount={filteredTasks.length}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Task Assignees Modal */}
      {rosterModal && (
        <RosterDetailModal
          open={rosterModal.open}
          onClose={() => setRosterModal(null)}
          title={rosterModal.title}
          members={rosterModal.members}
          canManage={false}
        />
      )}
    </div>
  );
};

export default Tasks;
