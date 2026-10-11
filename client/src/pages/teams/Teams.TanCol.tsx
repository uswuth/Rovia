import type { NavigateFunction } from 'react-router-dom';
import { Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { getProjectStatusTone } from '@/lib/status-tone';
import type { Column } from '@/components/ui/data-table';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';

export interface TeamRosterModalState {
  open: boolean;
  title: string;
  projectName?: string;
  teamName?: string;
  members: Member[];
  value: Record<string, 'Host' | 'Member'>;
}

export interface TeamColumnsOptions {
  navigate: NavigateFunction;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  onOpenRoster: (modalData: TeamRosterModalState) => void;
  onDelete: (teamId: string) => void;
}

export const getTeamColumns = ({
  navigate,
  isAdmin,
  isSuperAdmin,
  onOpenRoster,
  onDelete,
}: TeamColumnsOptions): Column<Record<string, unknown>>[] => {
  return [
    {
      id: 'teamCode',
      header: 'Team Code',
      width: '120px',
      minWidth: '110px',
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
      id: 'teamName',
      header: 'Team Name & Description',
      width: '260px',
      minWidth: '200px',
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
      minWidth: '150px',
      cell: (t) => {
        const pObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
        const pName = pObj ? ((pObj.projectName || pObj.name) as string) : 'Unassigned';
        return <span className="text-xs font-medium text-foreground">{pName}</span>;
      },
    },
    {
      id: 'roster',
      header: 'Team Roster',
      width: '150px',
      minWidth: '130px',
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
              onOpenRoster({
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
      id: 'teamStatus',
      header: 'Status',
      width: '120px',
      minWidth: '100px',
      cell: (t) => {
        const teamStatusStr = (t.teamStatus as string) || 'active';
        return <Badge tone={getProjectStatusTone(teamStatusStr)}>{teamStatusStr}</Badge>;
      },
    },
    {
      id: 'createdAt',
      header: 'Created At',
      width: '120px',
      minWidth: '110px',
      cell: (t) => (
        <span className="text-xs text-muted-foreground font-mono">
          {t.createdAt ? new Date(t.createdAt as string).toLocaleDateString() : 'N/A'}
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
          {t.updatedAt ? new Date(t.updatedAt as string).toLocaleDateString() : 'N/A'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right' as const,
      width: '100px',
      minWidth: '90px',
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
                onClick={() => onDelete(teamIdStr)}
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
};
