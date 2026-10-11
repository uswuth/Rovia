import type { NavigateFunction } from 'react-router-dom';
import { Phone, MapPin, Droplet, Edit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getRoleBadgeTone } from '@/lib/status-tone';
import type { Column } from '@/components/ui/data-table';
import type { Member } from '@/types/member.types';
import type { User as AuthUser } from '@/api/auth/auth.types';

export interface OrgMemberColumnsOptions {
  navigate: NavigateFunction;
  canManage: boolean;
  currentUser: AuthUser | null;
}

export const getOrgMemberColumns = ({
  navigate,
  canManage,
  currentUser,
}: OrgMemberColumnsOptions): Column<Member>[] => {
  return [
    {
      id: 'userCode',
      header: 'User Code',
      width: '110px',
      minWidth: '110px',
      cell: (m) => (
        <span className="font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
          {m.userCode || 'USR-N/A'}
        </span>
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
                className="font-semibold text-foreground text-sm leading-snug hover:text-emerald-500 hover:underline cursor-pointer text-left"
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
    {
      id: 'phoneNumber',
      header: 'Phone',
      width: '140px',
      minWidth: '130px',
      cell: (m) => {
        if (!canManage && m.userId !== currentUser?.userId) {
          return <span className="text-xs text-muted-foreground/60 italic">Private</span>;
        }
        return m.phoneNumber ? (
          <div className="flex items-center gap-1 text-xs text-foreground">
            <Phone size={12} className="text-muted-foreground shrink-0" />
            <span>{m.phoneNumber}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">No phone</span>
        );
      },
    },
    {
      id: 'bloodType',
      header: 'Blood Group',
      width: '110px',
      minWidth: '110px',
      cell: (m) => {
        if (!canManage && m.userId !== currentUser?.userId) {
          return <span className="text-xs text-muted-foreground/60 italic">Private</span>;
        }
        return m.bloodType ? (
          <div className="flex items-center gap-1 text-xs text-red-500 dark:text-red-400 font-medium">
            <Droplet size={12} className="shrink-0" />
            <span>{m.bloodType}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">N/A</span>
        );
      },
    },
    {
      id: 'city',
      header: 'City',
      width: '120px',
      minWidth: '110px',
      cell: (m) => {
        if (!canManage && m.userId !== currentUser?.userId) {
          return <span className="text-xs text-muted-foreground/60 italic">Private</span>;
        }
        return m.city ? (
          <span className="text-xs text-foreground font-medium">{m.city}</span>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">N/A</span>
        );
      },
    },
    {
      id: 'address',
      header: 'Address',
      width: '200px',
      minWidth: '180px',
      cell: (m) => {
        if (!canManage && m.userId !== currentUser?.userId) {
          return <span className="text-xs text-muted-foreground/60 italic">Private</span>;
        }
        return m.address ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" />
            <span className="line-clamp-1">{m.address}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">N/A</span>
        );
      },
    },
    {
      id: 'createdAt',
      header: 'Created At',
      width: '110px',
      minWidth: '110px',
      cell: (m) => {
        const created = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A';
        return <span className="text-xs text-muted-foreground font-mono">{created}</span>;
      },
    },
    {
      id: 'updatedAt',
      header: 'Updated At',
      width: '110px',
      minWidth: '110px',
      cell: (m) => {
        const updated = m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : 'N/A';
        return <span className="text-xs text-muted-foreground font-mono">{updated}</span>;
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
