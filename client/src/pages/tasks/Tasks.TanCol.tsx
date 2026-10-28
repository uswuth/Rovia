import type { NavigateFunction } from 'react-router-dom';
import {
  Edit2,
  FolderGit2,
  Users,
  CheckCircle2,
  Circle,
  CircleDashed,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import type { Column } from '@/components/ui/data-table';
import type { TaskStatusType } from '@/api/tasks/tasks.api';
import type { BadgeTone } from '@/components/ui/badge-variants';
import type { Member, MemberRole } from '@/types/member.types';
import { normalizeMemberList } from '@/components/members/member-utils';
import { formatDateOnly } from '@/lib/format-date';

export const KANBAN_COLUMNS: {
  id: TaskStatusType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: BadgeTone;
  iconColor: string;
}[] = [
    { id: 'backlog', label: 'Backlog', icon: CircleDashed, tone: 'accent', iconColor: 'text-purple-500 dark:text-purple-400' },
    { id: 'to_do', label: 'Todo', icon: Circle, tone: 'info', iconColor: 'text-blue-500 dark:text-blue-400' },
    { id: 'in_progress', label: 'In Progress', icon: Loader2, tone: 'warning', iconColor: 'text-amber-500 dark:text-amber-400' },
    { id: 'bug', label: 'Bug / Issue', icon: AlertCircle, tone: 'danger', iconColor: 'text-rose-500 dark:text-rose-400' },
    { id: 'completed', label: 'Done', icon: CheckCircle2, tone: 'success', iconColor: 'text-emerald-500 dark:text-emerald-400' },
  ];

export interface TaskColumnsOptions {
  navigate: NavigateFunction;
  isAdmin: boolean;
  canManage: boolean;
  onDelete: (taskId: string) => void;
  onOpenAssigneesModal?: (taskTitle: string, members: Member[]) => void;
  orgMembers?: Member[];
  currentUser?: { userId?: string; userName?: string; userEmail?: string; userRole?: string; avatarUrl?: string } | null;
}

export const getTaskColumns = ({
  navigate,
  canManage,
  onOpenAssigneesModal,
  orgMembers,
  currentUser,
}: TaskColumnsOptions): Column<Record<string, unknown>>[] => {
  return [
    {
      id: 'taskCode',
      header: 'Task Code',
      width: '120px',
      minWidth: '110px',
      cell: (t) => {
        const taskIdStr = (t.taskId || t._id || t.id) as string;
        const code = (t.taskCode as string) || (t.task_code as string) || (taskIdStr ? `TSK-${taskIdStr.slice(-4).toUpperCase()}` : 'TSK-N/A');
        const navId = ((t.taskCode || t.task_code || taskIdStr) as string) || '';
        return (
          <CodeBadge
            code={code}
            fallback="TSK-N/A"
            onClick={
              navId
                ? (e) => {
                    e.stopPropagation();
                    navigate(`/tasks/${navId}`);
                  }
                : undefined
            }
            title={navId ? 'View Task' : undefined}
          />
        );
      },
    },
    {
      id: 'taskTitle',
      header: 'Task Title',
      width: '220px',
      minWidth: '180px',
      cell: (t) => {
        const title = (t.taskTitle as string) || '';
        const taskIdStr = (t.taskId || t._id || t.id) as string;
        const navId = ((t.taskCode || t.task_code || taskIdStr) as string) || '';
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (navId) navigate(`/tasks/${navId}`);
            }}
            className="font-semibold text-foreground text-sm leading-snug hover:text-primary hover:underline cursor-pointer text-left block line-clamp-2"
            title="View Task Details"
          >
            {title}
          </button>
        );
      },
    },
    {
      id: 'taskDescription',
      header: 'Description',
      width: '240px',
      minWidth: '180px',
      cell: (t) => {
        const desc = (t.taskDescription as string) || '';
        return desc ? (
          <span className="text-xs text-muted-foreground line-clamp-2 block" title={desc}>
            {desc}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground/50">No description</span>
        );
      },
    },
    {
      id: 'taskStatus',
      header: 'Status',
      width: '140px',
      minWidth: '120px',
      cell: (t) => {
        const taskStatusStr = (t.taskStatus as TaskStatusType) || 'to_do';
        const colMeta = KANBAN_COLUMNS.find((c) => c.id === taskStatusStr) || KANBAN_COLUMNS[0];
        const Icon = colMeta.icon;

        return (
          <Badge tone={colMeta.tone} className="gap-1.5 text-xs font-semibold shadow-2xs">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${colMeta.iconColor}`} />
            <span>{colMeta.label}</span>
          </Badge>
        );
      },
    },
    {
      id: 'projectTeam',
      header: 'Project / Team',
      width: '200px',
      minWidth: '170px',
      cell: (t) => {
        const projObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
        const teamObj = typeof t.teamId === 'object' && t.teamId !== null ? (t.teamId as Record<string, unknown>) : null;
        const projName = projObj ? ((projObj.projectName || projObj.name) as string) : null;
        const teamName = teamObj ? (teamObj.teamName as string) : null;

        return (
          <div className="flex flex-col gap-1 text-xs">
            {projName && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20 font-medium w-fit max-w-[180px] truncate" title={projName}>
                <FolderGit2 size={12} className="shrink-0" />
                <span className="truncate">{projName}</span>
              </span>
            )}
            {teamName && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium w-fit max-w-[180px] truncate" title={teamName}>
                <Users size={12} className="shrink-0" />
                <span className="truncate">{teamName}</span>
              </span>
            )}
            {!projName && !teamName && (
              <span className="text-muted-foreground/50 italic text-[11px]">Workspace Task</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'assignees',
      header: 'Assignees',
      width: '150px',
      minWidth: '130px',
      cell: (t) => {
        const assignedArr = (t.assignedMembers || []) as (Member | string)[];
        const normalized = normalizeMemberList(assignedArr);
        const mappedMembers: Member[] = normalized.map((mem) => {
          const uid = mem.userId;
          const orgMatch = orgMembers?.find((om) => om.userId === uid || (om.userName && om.userName === mem.userName));
          const isCurrent = Boolean(currentUser && currentUser.userId === uid);
          return {
            ...mem,
            userName: orgMatch?.userName || (isCurrent && currentUser ? currentUser.userName : '') || mem.userName,
            userEmail: orgMatch?.userEmail || (isCurrent && currentUser ? currentUser.userEmail : '') || mem.userEmail,
            avatarUrl: orgMatch?.avatarUrl || (isCurrent && currentUser ? currentUser.avatarUrl : '') || mem.avatarUrl,
            userRole: (orgMatch?.userRole || (isCurrent && currentUser ? currentUser.userRole : '') || mem.userRole || 'Member') as MemberRole,
            userStatus: orgMatch?.userStatus || mem.userStatus,
          };
        });

        const taskTitleStr = (t.taskTitle as string) || 'Task';

        return (
          <GroupedAvatars
            members={mappedMembers}
            onClick={() => {
              if (onOpenAssigneesModal && mappedMembers.length > 0) {
                onOpenAssigneesModal(taskTitleStr, mappedMembers);
              }
            }}
          />
        );
      },
    },
    {
      id: 'createdBy',
      header: 'Assigned By',
      width: '180px',
      minWidth: '150px',
      cell: (t) => {
        const cObj = typeof t.createdBy === 'object' && t.createdBy !== null ? (t.createdBy as Record<string, unknown>) : null;
        const name = cObj ? ((cObj.userName || cObj.name || cObj.userEmail) as string) : (typeof t.createdBy === 'string' ? t.createdBy : null);
        const email = cObj ? (cObj.userEmail as string) : '';
        const avatarUrl = cObj ? (cObj.avatarUrl as string) : undefined;
        const userCode = cObj ? (cObj.userCode as string) : undefined;
        const memberId = cObj ? ((cObj.userId || cObj._id) as string) : undefined;

        if (!name) {
          return <span className="text-xs text-muted-foreground/50 italic">N/A</span>;
        }

        const profilePath = userCode
          ? `/organization/members/code/${userCode}`
          : memberId
            ? `/organization/members/${memberId}/profile`
            : null;

        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-7 w-7 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
              <AvatarFallback name={name}>{name[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              {profilePath ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(profilePath);
                  }}
                  className="font-medium text-foreground text-xs leading-tight hover:text-primary hover:underline cursor-pointer text-left truncate block max-w-[120px]"
                  title={`View ${name}'s profile`}
                >
                  {name}
                </button>
              ) : (
                <span className="font-medium text-foreground text-xs leading-tight truncate block max-w-[120px]">
                  {name}
                </span>
              )}
              {email && <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{email}</p>}
            </div>
          </div>
        );
      },
    },
    {
      id: 'createdAt',
      header: 'Created At',
      width: '120px',
      minWidth: '110px',
      cell: (t) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDateOnly(t.createdAt) || 'N/A'}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Updated At',
      width: '120px',
      minWidth: '110px',
      cell: (t) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDateOnly(t.updatedAt) || 'N/A'}
        </span>
      ),
    },
    ...(canManage
      ? [
        {
          id: 'actions',
          header: 'Actions',
          align: 'right' as const,
          width: '60px',
          minWidth: '60px',
          cell: (t: Record<string, unknown>) => {
            const taskIdStr = (t.taskId || t._id || t.id) as string;
            const navId = ((t.taskCode || t.task_code || taskIdStr) as string) || '';
            return (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/tasks/${navId}/edit`)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  title="Edit Task"
                >
                  <Edit2 size={14} />
                </Button>
              </div>
            );
          },
        },
      ]
      : []),
  ];
};
