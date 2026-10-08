import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  LayoutGrid,
  List,
  FolderGit2,
  CheckCircle2, Users,
  Circle,
  CircleDashed,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { getTasksApi, updateTaskApi, deleteTaskApi, type TaskStatusType } from '@/api/tasks/tasks.api';
import { getTeamsApi } from '@/api/teams/teams.api';
import { useAuth } from '@/context/AuthContext';
import { useProject } from '@/context/ProjectContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

import { extractApiItems } from '@/utils/apiResponse';
import { cn } from '@/lib/utils';

type BadgeTone = import('@/components/ui/badge-variants').BadgeTone;

const KANBAN_COLUMNS: {
  id: TaskStatusType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: BadgeTone;
  iconColor: string;
}[] = [
    { id: 'backlog', label: 'Backlog', icon: CircleDashed, tone: 'accent', iconColor: 'text-purple-500 dark:text-purple-400' },
    { id: 'to_do', label: 'Todo', icon: Circle, tone: 'info', iconColor: 'text-zinc-400' },
    { id: 'in_progress', label: 'In Progress', icon: Loader2, tone: 'warning', iconColor: 'text-amber-500 dark:text-amber-400' },
    { id: 'bug', label: 'Bug / Issue', icon: AlertCircle, tone: 'danger', iconColor: 'text-rose-500 dark:text-rose-400' },
    { id: 'completed', label: 'Done', icon: CheckCircle2, tone: 'success', iconColor: 'text-emerald-500 dark:text-emerald-400' },
  ];

export const Tasks: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projects: contextProjects } = useProject();
  const hasFetchedRef = useRef(false);

  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');
  const isHost = Boolean(isAdmin || (user?.userRole as string) === 'Host');
  const canManage = isHost;

  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const projects = useMemo(() => {
    return (contextProjects || []) as unknown as Record<string, unknown>[];
  }, [contextProjects]);

  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('kanban');
  const [search, setSearch] = useState('');
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

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this Task?')) return;
    const previousTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => (t.taskId || t._id || t.id) !== taskId));
    try {
      await deleteTaskApi(taskId);
    } catch (err: unknown) {
      setTasks(previousTasks);
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to delete task.');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatusType) => {
    const currentTask = tasks.find((t) => (t.taskId || t._id || t.id) === taskId);
    if (!currentTask || (currentTask.taskStatus as TaskStatusType) === newStatus) {
      return;
    }

    const previousStatus = currentTask.taskStatus as TaskStatusType;

    // 1. Optimistically update local tasks state immediately (0ms UI re-render, zero extra fetches)
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        const idStr = (t.taskId || t._id || t.id) as string;
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
          const idStr = (t.taskId || t._id || t.id) as string;
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
    return tasks.filter((t) => {
      const titleStr = (t.taskTitle as string) || '';
      const descStr = (t.taskDescription as string) || '';
      const matchesSearch =
        titleStr.toLowerCase().includes(search.toLowerCase()) ||
        descStr.toLowerCase().includes(search.toLowerCase());

      const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
      const projId = projObj ? ((projObj._id || projObj.projectId) as string) : (t.projectId as string);
      const matchesProj = projectFilter === 'ALL' || projId === projectFilter;

      const teamObj = typeof t.teamId === 'object' && t.teamId !== null ? (t.teamId as Record<string, unknown>) : null;
      const tmId = teamObj ? ((teamObj._id || teamObj.teamId) as string) : (t.teamId as string);
      const matchesTeam = teamFilter === 'ALL' || tmId === teamFilter;

      return matchesSearch && matchesProj && matchesTeam;
    });
  }, [tasks, search, projectFilter, teamFilter]);

  const columns: Column<Record<string, unknown>>[] = [
    {
      id: 'task',
      header: 'Task Title & Description',
      cell: (t) => {
        const title = (t.taskTitle as string) || '';
        const desc = (t.taskDescription as string) || '';
        return (
          <div>
            <span className="font-semibold text-foreground text-sm leading-snug block">
              {title}
            </span>
            {desc ? (
              <span className="text-xs text-muted-foreground line-clamp-1 block">{desc}</span>
            ) : (
              <span className="text-xs italic text-muted-foreground/50">No description</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '130px',
      cell: (t) => {
        const taskStatusStr = (t.taskStatus as TaskStatusType) || 'to_do';
        const colMeta = KANBAN_COLUMNS.find((c) => c.id === taskStatusStr) || KANBAN_COLUMNS[0];
        const Icon = colMeta.icon;

        return (
          <Badge tone={colMeta.tone} className="gap-1.5 text-xs font-semibold shadow-2xs">
            <Icon className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
            <span>{colMeta.label}</span>
          </Badge>
        );
      },
    },
    {
      id: 'projectTeam',
      header: 'Project / Team',
      width: '180px',
      cell: (t) => {
        const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
        const teamObj = typeof t.teamId === 'object' && t.teamId !== null ? (t.teamId as Record<string, unknown>) : null;
        const projName = projObj ? ((projObj.projectName || projObj.name) as string) : null;
        const teamName = teamObj ? (teamObj.teamName as string) : null;

        return (
          <div className="space-y-0.5 text-xs">
            {projName && (
              <div className="flex items-center gap-1 text-foreground font-medium">
                <FolderGit2 size={12} className="text-emerald-500" />
                <span>{projName}</span>
              </div>
            )}
            {teamName && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users size={12} />
                <span>{teamName}</span>
              </div>
            )}
            {!projName && !teamName && (
              <span className="text-muted-foreground/50 italic">Workspace Task</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'assignees',
      header: 'Assignees',
      width: '110px',
      cell: (t) => {
        const assignedArr = (t.assignedMembers as unknown[]) || [];
        return (
          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
            <Users size={13} className="text-muted-foreground" />
            <span>{assignedArr.length}</span>
          </div>
        );
      },
    },
    {
      id: 'createdAt',
      header: 'Created At',
      width: '110px',
      cell: (t) => {
        const date = t.createdAt ? new Date(t.createdAt as string).toLocaleDateString() : 'N/A';
        return <span className="text-xs text-muted-foreground font-mono">{date}</span>;
      },
    },
    ...(canManage
      ? [
        {
          id: 'actions',
          header: 'Actions',
          align: 'right' as const,
          width: '80px',
          cell: (t: Record<string, unknown>) => {
            const taskIdStr = (t.taskId || t._id) as string;
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/tasks/${taskIdStr}/edit`)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  title="Edit Task"
                >
                  <Edit2 size={14} />
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(taskIdStr)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    title="Delete Task"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            );
          },
        },
      ]
      : []),
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
    <div className="w-full flex-1 flex flex-col bg-background text-foreground p-6 lg:p-8 space-y-6 min-h-0">
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

          <Select
            value={projectFilter}
            onValueChange={(val) => {
              if (val) {
                setProjectFilter(String(val));
                setCurrentPage(1);
              }
            }}
          >
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Projects">
                {(val: unknown) => {
                  if (val === 'ALL' || !val) return 'All Projects';
                  const match = projects.find((p) => (p.projectId || p._id || p.id) === val);
                  return match ? ((match.projectName || match.name) as string) : String(val);
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Projects</SelectItem>
              {projects.map((p) => {
                const pId = (p.projectId || p._id || p.id) as string;
                const pName = (p.projectName || p.name) as string;
                return (
                  <SelectItem key={pId} value={pId}>
                    {pName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select
            value={teamFilter}
            onValueChange={(val) => {
              if (val) {
                setTeamFilter(String(val));
                setCurrentPage(1);
              }
            }}
          >
            <SelectTrigger className="w-44 h-9 text-xs">
              <SelectValue placeholder="All Teams">
                {(val: unknown) => {
                  if (val === 'ALL' || !val) return 'All Teams';
                  const match = teams.find((tm) => (tm.teamId || tm._id) === val);
                  return match ? (match.teamName as string) : String(val);
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Teams</SelectItem>
              {teams.map((tm) => {
                const tmId = (tm.teamId || tm._id) as string;
                const tmName = tm.teamName as string;
                return (
                  <SelectItem key={tmId} value={tmId}>
                    {tmName}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
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
            const isDragOver = dragOverColumnId === col.id;

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
                className={cn(
                  'p-1 flex flex-col flex-1 min-h-[500px] lg:min-h-0 space-y-3 transition-all duration-150',
                  isDragOver
                    ? 'border border-emerald-500/80 bg-emerald-500/5 ring-2 ring-emerald-500/20 rounded-lg shadow-md'
                    : ''
                )}
              >
                <div className="flex items-center justify-between pb-3 border-b border-border/60">
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

                <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                  {columnTasks.length === 0 ? (
                    <div className="h-32 border border-dashed border-border/50 rounded-md flex items-center justify-center text-xs text-muted-foreground/50 italic">
                      No tasks
                    </div>
                  ) : (
                    columnTasks.map((task, idx) => {
                      const taskIdStr = (task.taskId || task._id) as string;
                      const taskCodeStr = (task.taskCode || `TSK-${(idx + 1).toString().padStart(2, '0')}`) as string;
                      const taskTitleStr = (task.taskTitle as string) || '';
                      const taskDescStr = (task.taskDescription as string) || '';
                      const assignedArr = (task.assignedMembers as unknown[]) || [];
                      const isBeingDragged = draggedTaskId === taskIdStr;

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
                            'rounded-md border border-border/80 bg-card p-3 hover:border-emerald-500/50 transition-all duration-150 space-y-2 group shadow-2xs select-none',
                            canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
                            isBeingDragged ? 'opacity-30 scale-95 border-emerald-500/60 ring-2 ring-emerald-500/30' : ''
                          )}
                        >
                          {/* Top row: Task Code / ID & Action icons */}
                          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                            <span className="font-semibold text-foreground/80 tracking-wider">
                              {taskCodeStr}
                            </span>
                            {canManage && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => navigate(`/tasks/${taskIdStr}/edit`)}
                                  className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                  title="Edit Task"
                                >
                                  <Edit2 size={11} />
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(taskIdStr)}
                                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                    title="Delete Task"
                                  >
                                    <Trash2 size={11} />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Task Title */}
                          <h4 className="font-semibold text-xs text-foreground leading-snug">
                            {taskTitleStr}
                          </h4>

                          {Boolean(taskDescStr) && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {taskDescStr}
                            </p>
                          )}

                          {/* Card Footer: Project Badge & Assignees Count */}
                          <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {Boolean(task.projectId) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium border border-border/50">
                                  <FolderGit2 size={10} className="text-emerald-500" />
                                  <span className="truncate max-w-[90px]">
                                    {typeof task.projectId === 'object' && task.projectId !== null
                                      ? ((task.projectId as Record<string, unknown>).projectName as string)
                                      : 'Project'}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium bg-secondary/50 px-1.5 py-0.5 rounded-md border border-border/40">
                              <Users size={11} />
                              <span>{assignedArr.length}</span>
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
    </div>
  );
};

export default Tasks;
