import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Edit2,
  Trash2,
  ChevronDown,
  Shield,
  Briefcase,
} from 'lucide-react';
import type { Member, MemberRole, MemberStatus } from '@/types/member.types';
import { useAuth } from '@/context/AuthContext';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EditMemberModal } from './EditMemberModal';
import { DeleteMemberModal } from './DeleteMemberModal';
import { ManageJobTitlesModal } from './ManageJobTitlesModal';

interface MembersTableProps {
  initialMembers: Member[];
  inviteCode?: string;
  onUpdateMember: (updated: Member) => void;
  onRemoveMember: (id: string) => void;
}

export const MembersTable: React.FC<MembersTableProps> = ({
  initialMembers,
  onUpdateMember,
  onRemoveMember,
}) => {
  const { user } = useAuth();
  const isTopAdmin = Boolean(
    user?.isSuperAdmin ||
    ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes((user?.userRole || '').toUpperCase())
  );
  const isHost = (user?.userRole || '').toUpperCase() === 'HOST';
  const isVisitor = (user?.userRole || '').toUpperCase() === 'VISITOR';

  // Members, Hosts, Admins, and SuperAdmins CAN see emails; only Visitors CANNOT
  const canSeeEmail = !isVisitor;

  // The Visitor role tag is ONLY seen by Host, Admin, and SuperAdmin; NOT Member or Visitor
  const canSeeVisitorRole = isTopAdmin || isHost;

  const [isJobTitlesModalOpen, setIsJobTitlesModalOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);

  // Active filter logic & normalization for any backend format (User or Member)
  const filteredData: Member[] = useMemo(() => {
    return initialMembers
      .map((m: Member): Member => ({
        id: m.id || m._id || m.userId || Math.random().toString(),
        name: m.name || m.userName || m.userEmail || 'Team Member',
        email: canSeeEmail ? (m.email || m.userEmail || '') : '',
        role: (m.role || m.userRole || 'Member') as MemberRole,
        status: (m.status || 'Active') as MemberStatus,
        jobTitle: m.jobTitle || (m as unknown as Record<string, string>).job_title || '',
        joinedAt: m.joinedAt
          ? String(m.joinedAt).split('T')[0]
          : m.createdAt
            ? String(m.createdAt).split('T')[0]
            : '2026-03-01',
        avatarUrl: m.avatarUrl || '',
        isSuperAdmin: m.isSuperAdmin,
      }))
      .filter((member) => {
        const matchesRole = roleFilter === 'ALL' || member.role === roleFilter;
        const matchesStatus = statusFilter === 'ALL' || member.status === statusFilter;
        const matchesSearch =
          !globalFilter ||
          (member.name && member.name.toLowerCase().includes(globalFilter.toLowerCase())) ||
          (canSeeEmail && member.email && member.email.toLowerCase().includes(globalFilter.toLowerCase())) ||
          (member.jobTitle && member.jobTitle.toLowerCase().includes(globalFilter.toLowerCase()));
        return matchesRole && matchesStatus && matchesSearch;
      });
  }, [initialMembers, roleFilter, statusFilter, globalFilter, canSeeEmail]);

  const columns: Column<Member>[] = useMemo(() => {
    const list: Column<Member>[] = [
      {
        id: 'name',
        header: 'Member',
        width: '220px',
        cell: (member) => {
          const displayName = member.name || member.email || 'Member';
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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold text-xs border border-emerald-500/20 shrink-0">
                {initials}
              </div>
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
                  <div className="text-xs text-muted-foreground font-normal truncate">{member.email || 'No email'}</div>
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
        width: '130px',
        cell: (member) => {
          const rawRole = member.role;
          const role: MemberRole = ['SuperAdmin', 'Admin', 'Host', 'Member', 'Visitor'].includes(rawRole)
            ? rawRole
            : 'Member';

          const displayRole = (role === 'Visitor' && !canSeeVisitorRole) ? 'Member' : role;

          const roleBadgeStyles: Record<MemberRole, string> = {
            SuperAdmin:
              'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 shadow-xs',
            Admin: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 shadow-xs',
            Host: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 shadow-xs',
            Member: 'bg-secondary text-secondary-foreground border-border shadow-xs',
            Visitor: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 shadow-xs',
          };

          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${roleBadgeStyles[displayRole]}`}
            >
              <Shield size={12} />
              {displayRole}
            </span>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        width: '120px',
        cell: (member) => {
          const rawStatus = member.status;
          const status: MemberStatus = ['Active', 'Pending', 'Suspended'].includes(rawStatus)
            ? rawStatus
            : 'Active';

          const statusStyles: Record<MemberStatus, { dot: string; text: string }> = {
            Active: { dot: 'bg-emerald-500 dark:bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-400 font-semibold' },
            Pending: { dot: 'bg-amber-500 dark:bg-amber-400', text: 'text-amber-700 dark:text-amber-400 font-semibold' },
            Suspended: { dot: 'bg-red-500 dark:bg-red-400', text: 'text-red-700 dark:text-red-400 font-semibold' },
          };

          const style = statusStyles[status];

          return (
            <span className={`inline-flex items-center gap-1.5 text-xs ${style.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot} animate-pulse`} />
              {status}
            </span>
          );
        },
      },
      {
        id: 'joinedAt',
        header: 'Joined Date',
        width: '130px',
        cell: (member) => (
          <span className="text-xs text-muted-foreground font-mono">
            {member.joinedAt || '2026-03-01'}
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
        cell: (member) => {
          const isTargetSuperAdmin = member.role === 'SuperAdmin' || member.isSuperAdmin;
          const isCurrentSuperAdmin = Boolean(
            user?.isSuperAdmin || (user?.userRole || '').toUpperCase().includes('SUPER')
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
                  setEditingMember(member);
                }}
                title="Edit Role & Status"
                className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingMember(member);
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
  }, [isTopAdmin, user, canSeeEmail, canSeeVisitorRole]);

  return (
    <div className="w-full space-y-4">
      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-10 w-full rounded-md border border-border/80 bg-card pl-10 pr-3.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-xs"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="appearance-none h-10 rounded-md border border-border/80 bg-card pl-8 pr-10 text-xs font-medium text-foreground focus:border-emerald-500 transition-all cursor-pointer shadow-xs"
            >
              <option value="ALL">All Roles</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="Admin">Admin</option>
              <option value="Host">Host</option>
              <option value="Member">Member</option>
            </select>
            <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-2 pointer-events-none border-l border-emerald-500/30">
              <ChevronDown size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none h-10 rounded-md border border-border/80 bg-card px-3 pr-10 text-xs font-medium text-foreground focus:border-emerald-500 transition-all cursor-pointer shadow-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Suspended">Suspended</option>
            </select>
            <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-2 pointer-events-none border-l border-emerald-500/30">
              <ChevronDown size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          {/* Job Titles Manager Button (TopAdmin Only) */}
          {isTopAdmin && (
            <button
              onClick={() => setIsJobTitlesModalOpen(true)}
              className="h-10 px-3 rounded-md border border-border/80 bg-card hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Manage Organization Job Titles"
            >
              <Briefcase size={14} className="text-emerald-500" />
              <span className="hidden sm:inline">Job Titles</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table via shared DataTable component with resizable columns & unified pagination */}
      <DataTable
        columns={columns}
        data={filteredData}
        keyExtractor={(m) => m.id}
        emptyMessage="No organization members found matching your search."
        pageSize={5}
        pageSizeOptions={[5, 10, 20, 50]}
      />

      {/* Edit Modal */}
      <EditMemberModal
        key={editingMember?.id}
        isOpen={!!editingMember}
        member={editingMember}
        onClose={() => setEditingMember(null)}
        onSave={onUpdateMember}
      />

      {/* Delete Confirmation Modal */}
      <DeleteMemberModal
        isOpen={!!deletingMember}
        member={deletingMember}
        onClose={() => setDeletingMember(null)}
        onConfirm={onRemoveMember}
      />

      {/* Manage Job Titles Modal */}
      <ManageJobTitlesModal
        isOpen={isJobTitlesModalOpen}
        onClose={() => setIsJobTitlesModalOpen(false)}
      />
    </div>
  );
};
