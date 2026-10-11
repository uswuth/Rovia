import type { NavigateFunction } from 'react-router-dom';
import { Video, CheckSquare, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { getProjectStatusTone } from '@/lib/status-tone';
import type { Column } from '@/components/ui/data-table';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';
import {
  getProjectName,
  getProjectCode,
  getProjectDesc,
  getProjectStatus,
  getProjectId,
  type Project,
} from '@/types/project.types';
import type { Meeting } from '@/api/meeting/meeting.types';

export interface ProjectRosterModalState {
  open: boolean;
  title: string;
  projectName?: string;
  members: Member[];
  value: Record<string, 'Host' | 'Member'>;
}

export interface ProjectColumnsOptions {
  navigate: NavigateFunction;
  meetings?: Meeting[];
  onOpenRoster: (modalData: ProjectRosterModalState) => void;
}

export const getProjectColumns = ({
  navigate,
  meetings,
  onOpenRoster,
}: ProjectColumnsOptions): Column<Project>[] => {
  return [
    {
      id: 'code',
      header: 'Code',
      width: '120px',
      minWidth: '110px',
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
      width: '200px',
      minWidth: '180px',
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
      width: '260px',
      minWidth: '200px',
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
      minWidth: '100px',
      cell: (project) => {
        const pStatus = getProjectStatus(project);
        return <Badge tone={getProjectStatusTone(pStatus)}>{pStatus}</Badge>;
      },
    },
    {
      id: 'team',
      header: 'Team',
      width: '150px',
      minWidth: '130px',
      cell: (project) => {
        const hostList = Array.isArray(project.hosts) ? project.hosts : [];
        const memberList = Array.isArray(project.members) ? project.members : [];
        const rawList = [...hostList, ...memberList];
        const mappedMembers: Member[] = rawList.map((m) => {
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
        hostList.forEach((h) => {
          const id = typeof h === 'string' ? h : ((h as Record<string, string>).userId || (h as Record<string, string>)._id);
          if (id) valueMap[id] = 'Host';
        });
        memberList.forEach((m) => {
          const id = typeof m === 'string' ? m : ((m as Record<string, string>).userId || (m as Record<string, string>)._id);
          if (id && !valueMap[id]) valueMap[id] = 'Member';
        });

        const pName = getProjectName(project);

        return (
          <GroupedAvatars
            members={mappedMembers}
            onClick={() => {
              onOpenRoster({
                open: true,
                title: `Project Members: ${pName}`,
                projectName: pName,
                members: mappedMembers,
                value: valueMap,
              });
            }}
          />
        );
      },
    },
    {
      id: 'meetings',
      header: 'Meets',
      width: '100px',
      minWidth: '90px',
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
      minWidth: '90px',
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
      id: 'createdAt',
      header: 'Created At',
      width: '120px',
      minWidth: '110px',
      cell: (project) => (
        <span className="text-xs text-muted-foreground font-mono">
          {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'updatedAt',
      header: 'Updated At',
      width: '120px',
      minWidth: '110px',
      cell: (project) => (
        <span className="text-xs text-muted-foreground font-mono">
          {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: '90px',
      minWidth: '90px',
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
};
