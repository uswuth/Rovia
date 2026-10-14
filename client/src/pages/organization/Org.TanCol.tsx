import type { NavigateFunction } from 'react-router-dom';
import { Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CodeBadge } from '@/components/ui/CodeBadge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getRoleBadgeTone } from '@/lib/status-tone';
import type { Column } from '@/components/ui/data-table';
import type { Member } from '@/types/member.types';

export interface OrgMemberColumnsOptions {
  navigate: NavigateFunction;
  canManage: boolean;
}

export const getOrgMemberColumns = ({
  navigate,
  canManage,
}: OrgMemberColumnsOptions): Column<Member>[] => {
  return [
    {
      id: 'userCode',
      header: 'User Code',
      width: '110px',
      minWidth: '110px',
      cell: (m) => (
        <CodeBadge code={m.userCode} fallback="USR-N/A" />
      ),
    },
    {
      id: 'name',
      header: 'Member Name & Email',
      width: '220px',
      minWidth: '220px',
      cell: (m) => {
        const name = m.userName || 'Unnamed';
        const email = m.userEmail || '';
        const userCode = m.userCode || '';
        const memberId = m.userId || '';
        const profilePath = userCode
          ? `/organization/members/code/${userCode}`
          : `/organization/members/${memberId}/profile`;

        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={name} />}
              <AvatarFallback name={name}>{name[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <button
                type="button"
                onClick={() => navigate(profilePath)}
                className="font-semibold text-foreground text-sm leading-snug hover:text-primary hover:underline cursor-pointer text-left"
              >
                {name}
              </button>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'jobTitle',
      header: 'Job Role',
      width: '140px',
      minWidth: '140px',
      cell: (m) => (
        <span className="text-xs text-foreground font-medium">
          {m.jobTitle || 'Team Member'}
        </span>
      ),
    },
    {
      id: 'userRole',
      header: 'Org Role',
      width: '120px',
      minWidth: '120px',
      cell: (m) => <Badge tone={getRoleBadgeTone(m.userRole || 'Member')}>{m.userRole || 'Member'}</Badge>,
    },
    {
      id: 'userStatus',
      header: 'Status',
      width: '100px',
      minWidth: '100px',
      cell: (m) => {
        const status = m.userStatus || 'ACTIVE';
        return (
          <Badge tone={status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'danger'}>
            {status}
          </Badge>
        );
      },
    },
    ...(canManage
      ? [
        {
          id: 'actions',
          header: 'Actions',
          align: 'right' as const,
          width: '80px',
          minWidth: '80px',
          cell: (m: Member) => (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/organization/members/${m.userId}/edit`)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                title="Edit Member Profile"
              >
                <Edit2 size={14} />
              </Button>
            </div>
          ),
        },
      ]
      : []),
  ];
};
