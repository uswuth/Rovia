import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  FolderGit2,
  Users,
  AlertCircle,
  Calendar,
  Clock,
  UserCheck,
} from 'lucide-react';
import { getTaskByIdApi, type TaskStatusType } from '@/api/tasks/tasks.api';
import { extractApiItem } from '@/utils/apiResponse';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { KANBAN_COLUMNS } from './Tasks.TanCol';
import { getUserStatusTone } from '@/lib/status-tone';
import { cn } from '@/lib/utils';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';

export const TaskView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { members: orgMembers } = useOrganization();

  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');
  const isHost = Boolean(isAdmin || (user?.userRole as string) === 'Host');
  const canManage = isHost;

  const [task, setTask] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    const fetchTask = async () => {
      try {
        setLoading(true);
        const res = await getTaskByIdApi(id);
        if (!isMounted) return;
        const data = extractApiItem<Record<string, unknown>>(res);
        setTask(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        console.error(err);
        setError('Failed to load task details. The task might have been deleted or moved.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchTask();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const formatDate = (dateVal?: unknown) => {
    if (!dateVal || (typeof dateVal !== 'string' && typeof dateVal !== 'number' && !(dateVal instanceof Date))) return null;
    const d = new Date(dateVal as string);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const taskTitleStr = (task?.taskTitle as string) || '';
  const taskDescStr = (task?.taskDescription as string) || '';
  const taskCodeStr = (task?.taskCode as string) || (id ? `TSK-${id.slice(-4).toUpperCase()}` : 'TSK-N/A');
  const taskStatusStr = (task?.taskStatus as TaskStatusType) || 'to_do';

  const projObj = typeof task?.projectId === 'object' && task?.projectId !== null ? (task.projectId as Record<string, unknown>) : null;
  const teamObj = typeof task?.teamId === 'object' && task?.teamId !== null ? (task.teamId as Record<string, unknown>) : null;
  const projName = projObj ? (projObj.projectName as string) : (typeof task?.projectId === 'string' ? task.projectId : null);
  const teamName = teamObj ? (teamObj.teamName as string) : null;

  const colMeta = KANBAN_COLUMNS.find((c) => c.id === taskStatusStr) || KANBAN_COLUMNS[0];
  const StatusIcon = colMeta.icon;

  const assignees: Member[] = useMemo(() => {
    const rawArr = (task?.assignedMembers as unknown[]) || [];
    return rawArr.map((m) => {
      const obj = typeof m === 'object' && m !== null ? (m as Record<string, unknown>) : { userId: m as string };
      const mId = (obj.userId || obj._id || '') as string;
      const mEmail = (obj.userEmail || '') as string;

      const realMatch = (orgMembers?.find(
        (om) =>
          (om.userId && om.userId === mId) ||
          (Boolean(mEmail) && om.userEmail?.toLowerCase() === mEmail.toLowerCase())
      ) || (user?.userId === mId ? user : null)) as Partial<Member> | null;

      const mName = realMatch?.userName || (obj.userName as string) || mEmail || mId;
      const mRole = realMatch?.isSuperAdmin || realMatch?.userRole === 'SuperAdmin'
        ? 'SuperAdmin'
        : (realMatch?.userRole || (obj.userRole as MemberRole) || 'Member');
      const mStatus = realMatch?.userStatus || (obj.userStatus as MemberStatus) || 'ACTIVE';

      return {
        userId: mId,
        userName: mName,
        userEmail: realMatch?.userEmail || mEmail,
        userRole: mRole as MemberRole,
        userStatus: mStatus as MemberStatus,
        userCode: realMatch?.userCode || (obj.userCode as string) || undefined,
        avatarUrl: realMatch?.avatarUrl || (obj.avatarUrl as string) || undefined,
        jobTitle: realMatch?.jobTitle || (obj.jobTitle as string) || undefined,
        createdAt: (obj.createdAt as string) || '',
      };
    });
  }, [task?.assignedMembers, orgMembers, user]);

  const cObj = typeof task?.createdBy === 'object' && task?.createdBy !== null ? (task.createdBy as Record<string, unknown>) : null;
  const creatorId = (cObj?.userId || cObj?._id || (typeof task?.createdBy === 'string' ? task.createdBy : '')) as string;
  const creatorEmail = (cObj?.userEmail || '') as string;
  const creatorNameRaw = (cObj?.userName || (typeof task?.createdBy === 'string' ? task.createdBy : '')) as string;

  const realCreator = (orgMembers?.find(
    (om) =>
      (om.userId && om.userId === creatorId) ||
      (Boolean(creatorEmail) && om.userEmail?.toLowerCase() === creatorEmail.toLowerCase())
  ) || (user?.userId === creatorId ? user : null)) as Partial<Member> | null;

  const resolvedCreatorName = realCreator?.userName || creatorNameRaw || 'User';
  const resolvedCreatorRole = realCreator?.isSuperAdmin || realCreator?.userRole === 'SuperAdmin'
    ? 'SuperAdmin'
    : (realCreator?.userRole || (cObj?.userRole as string) || 'Member');
  const resolvedCreatorAvatar = realCreator?.avatarUrl || (cObj?.avatarUrl as string) || undefined;
  const resolvedCreatorUserCode = realCreator?.userCode || (cObj?.userCode as string) || undefined;

  const creatorProfilePath = resolvedCreatorUserCode
    ? `/organization/members/code/${resolvedCreatorUserCode}`
    : creatorId
    ? `/organization/members/${creatorId}/profile`
    : null;

  const createdAtFormatted = formatDate(task?.createdAt);
  const updatedAtFormatted = formatDate(task?.updatedAt);

  if (loading) {
    return (
      <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-72 rounded-sm" />
          <Skeleton className="lg:col-span-1 h-72 rounded-sm" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 lg:p-8 space-y-6">
        <Button variant="ghost" onClick={() => navigate('/tasks')} className="gap-2 text-xs">
          <ArrowLeft size={14} />
          <span>Back to Tasks</span>
        </Button>
        <div className="p-8 rounded-sm border border-destructive/30 bg-destructive/5 text-center space-y-3">
          <AlertCircle className="mx-auto text-destructive" size={32} />
          <h2 className="text-base font-bold text-foreground">Task Not Found</h2>
          <p className="text-xs text-muted-foreground">{error || 'Could not find the requested task.'}</p>
          <Button onClick={() => navigate('/tasks')} size="sm">
            Go to Task Board
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Top Header Breadcrumb / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/tasks')}
            className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Tasks</span>
          </Button>
          <span className="text-muted-foreground/40 font-mono">/</span>
          <span className="text-xs font-mono text-muted-foreground font-semibold">
            {taskCodeStr}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              onClick={() => navigate(`/tasks/${taskCodeStr || id}/edit`)}
              size="sm"
              className="h-8 px-3 gap-1.5 text-xs shadow-xs cursor-pointer"
            >
              <Edit2 size={13} />
              <span>Edit Task</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Task Title Row with Badges at End */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/60 min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight flex-1 break-words [overflow-wrap:anywhere] min-w-0">
          {taskTitleStr}
        </h1>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Badge tone={colMeta.tone} className="gap-1.5 text-xs font-semibold">
            <StatusIcon className={cn('w-3.5 h-3.5', colMeta.iconColor)} />
            <span>{colMeta.label}</span>
          </Badge>

          {projName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-secondary text-secondary-foreground text-xs font-medium border border-border/60">
              <FolderGit2 size={12} className="text-emerald-500 shrink-0" />
              <span>{projName}</span>
            </span>
          )}

          {teamName && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-500/20">
              <Users size={12} className="shrink-0" />
              <span>{teamName}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main 2-Column Content Layout (Frameless, clean section design) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start min-w-0 max-w-full">
        {/* Left Column: Description & Metadata */}
        <div className="lg:col-span-8 space-y-6 min-w-0 max-w-full overflow-hidden">
          {/* Task Description */}
          <div className="space-y-2 min-w-0 max-w-full">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Description
            </label>
            <div className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap break-words [overflow-wrap:anywhere] break-all leading-relaxed bg-muted/15 p-4 rounded-sm border border-border/40 min-h-[140px] max-w-full overflow-hidden">
              {taskDescStr || <span className="italic text-muted-foreground/50">No description provided for this task.</span>}
            </div>
          </div>

          {/* Task Metadata Footer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/50 text-xs text-muted-foreground min-w-0">
            {/* Creator / Assigned By */}
            <div className="space-y-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Assigned By
              </span>
              {creatorId ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    {resolvedCreatorAvatar && <AvatarImage src={resolvedCreatorAvatar} alt={resolvedCreatorName} />}
                    <AvatarFallback name={resolvedCreatorName} className="font-bold text-xs">
                      {resolvedCreatorName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    {creatorProfilePath ? (
                      <Link
                        to={creatorProfilePath}
                        className="font-medium text-foreground text-xs hover:text-emerald-500 hover:underline truncate block"
                      >
                        {resolvedCreatorName}
                      </Link>
                    ) : (
                      <p className="font-medium text-foreground text-xs truncate">{resolvedCreatorName}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground font-medium">{resolvedCreatorRole}</p>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground/50 italic">System Assigned</span>
              )}
            </div>

            {/* Timestamps */}
            <div className="space-y-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Activity
              </span>
              <div className="space-y-1 text-[11px]">
                {createdAtFormatted && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar size={12} className="shrink-0" />
                    <span>Created: <span className="text-foreground font-mono">{createdAtFormatted}</span></span>
                  </div>
                )}
                {updatedAtFormatted && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock size={12} className="shrink-0" />
                    <span>Updated: <span className="text-foreground font-mono">{updatedAtFormatted}</span></span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Assigned Members / Roster List */}
        <div className="lg:col-span-4 space-y-4 min-w-0 max-w-full">
          <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-500" />
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                Assigned Members
              </h3>
            </div>
            <Badge tone="neutral" className="text-xs font-mono">
              {assignees.length}
            </Badge>
          </div>

          {assignees.length === 0 ? (
            <div className="py-8 text-center space-y-1.5 border border-dashed border-border/50 rounded-sm">
              <Users size={24} className="mx-auto text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground/60 italic">No members assigned to this task.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {assignees.map((m, idx) => {
                const name = m.userName || m.userEmail || 'Member';
                const email = m.userEmail || '';
                const role = m.userRole || 'Member';
                const status = m.userStatus || 'ACTIVE';
                const memberProfilePath = m.userCode
                  ? `/organization/members/code/${m.userCode}`
                  : m.userId
                  ? `/organization/members/${m.userId}/profile`
                  : null;

                return (
                  <div
                    key={m.userId || idx}
                    className="flex items-center justify-between p-2.5 rounded-sm border border-border/40 bg-muted/10 hover:bg-muted/25 transition-colors gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <Avatar className="h-8 w-8 shrink-0">
                        {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={name} />}
                        <AvatarFallback name={name} className="font-bold text-xs">
                          {name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        {memberProfilePath ? (
                          <Link
                            to={memberProfilePath}
                            className="text-xs font-semibold text-foreground hover:text-emerald-500 hover:underline truncate block"
                          >
                            {name}
                          </Link>
                        ) : (
                          <p className="text-xs font-semibold text-foreground truncate">{name}</p>
                        )}
                        {email && <p className="text-[11px] text-muted-foreground truncate">{email}</p>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge tone="neutral" className="text-[10px] py-0 px-1.5">
                        {role}
                      </Badge>
                      <Badge tone={getUserStatusTone(status)} className="text-[9px] py-0 px-1.5">
                        {status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskView;
