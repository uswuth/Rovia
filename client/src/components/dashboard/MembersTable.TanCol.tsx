import { Edit2, Trash2, Shield } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import type { Column } from '@/components/ui/data-table';
import type { Member, MemberRole } from '@/types/member.types';
import type { User as AuthUser } from '@/api/auth/auth.types';

export interface MembersTableColumnsOptions {
  isTopAdmin: boolean;
  currentUser: AuthUser | null;
  canSeeEmail: boolean;
  onEdit: (member: Member) => void;
  onDelete: (member: Member) => void;
}

export const getDashboardMemberColumns = ({
  isTopAdmin,
  currentUser,
  canSeeEmail,
  onEdit,
  onDelete,
}: MembersTableColumnsOptions): Column<Member>[] => {
  const list: Column<Member>[] = [
    {
      id: 'name',
      header: 'Member',
      width: '260px',
      minWidth: '220px',
      cell: (member) => {
        const displayName = member.userName || 'Member';
        const initials =
          displayName
            .split(' ')
            .filter(Boolean)
            .map((n) => n[0])
            .join('')
            .substring(0, 2)
            .toUpperCase() || 'M';

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 shrink-0">
              {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={displayName} />}
              <AvatarFallback name={displayName}>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground text-sm leading-snug truncate">
                  {displayName}
                </span>
                {member.jobTitle && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-secondary text-muted-foreground border border-border shrink-0">
                    {member.jobTitle}
                  </span>
                )}
              </div>
              {canSeeEmail ? (
                <div className="text-xs text-muted-foreground font-normal truncate">{member.userEmail || 'No email'}</div>
              ) : (
                <div className="text-[11px] text-muted-foreground/70 font-normal">Attendee</div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: 'role',
      header: 'Role',
      width: '140px',
      minWidth: '120px',
      cell: (member) => {
        const rawRole = member.userRole || 'Member';
        const role: MemberRole = ['SuperAdmin', 'Admin', 'Member'].includes(rawRole)
          ? (rawRole as MemberRole)
          : 'Member';

        const roleBadgeStyles: Record<MemberRole, string> = {
          SuperAdmin:
            'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 shadow-xs',
          Admin: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shadow-xs',
          Member: 'bg-secondary text-secondary-foreground border-border shadow-xs',
        };

        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-semibold border ${roleBadgeStyles[role]}`}
          >
            <Shield size={12} />
            {role}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '130px',
      minWidth: '110px',
      cell: (member) => {
        const rawStatus = member.userStatus || 'ACTIVE';
        const isActive = rawStatus === 'ACTIVE';

        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
              isActive
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full animate-pulse ${
                isActive ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'
              }`}
            />
            {rawStatus}
          </span>
        );
      },
    },
    {
      id: 'joinedAt',
      header: 'Joined Date',
      width: '130px',
      minWidth: '110px',
      cell: (member) => (
        <span className="text-xs text-muted-foreground font-mono">
          {member.createdAt || 'N/A'}
        </span>
      ),
    },
  ];

  if (isTopAdmin) {
    list.push({
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: '90px',
      minWidth: '90px',
      cell: (member) => {
        const isTargetSuperAdmin = member.userRole === 'SuperAdmin' || member.isSuperAdmin;
        const isCurrentSuperAdmin = Boolean(
          currentUser?.isSuperAdmin || (currentUser?.userRole || '').toUpperCase().includes('SUPER')
        );
        const canModifyThisMember = isCurrentSuperAdmin || !isTargetSuperAdmin;

        if (!canModifyThisMember) {
          return (
            <div className="flex items-center justify-end">
              <span className="text-[10px] text-muted-foreground/60 italic font-mono px-2 py-0.5">
                Locked
              </span>
            </div>
          );
        }

        return (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(member);
              }}
              title="Edit Role & Status"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(member);
              }}
              title="Remove Member"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      },
    });
  }

  return list;
};
