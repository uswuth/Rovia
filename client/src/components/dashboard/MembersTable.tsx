import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  ChevronDown,
  Briefcase,
} from 'lucide-react';
import type { Member } from '@/types/member.types';
import { useAuth } from '@/context/AuthContext';
import { DataTable } from '@/components/ui/data-table';
import { EditMemberModal } from './EditMemberModal';
import { DeleteMemberModal } from './DeleteMemberModal';
import { getDashboardMemberColumns } from './MembersTable.TanCol';

interface MembersTableProps {
  initialMembers: Member[];
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
  const canSeeEmail = true;

  const navigate = useNavigate();
  const [globalFilter, setGlobalFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);

  // Active filter logic using standard Member interface fields
  const filteredData: Member[] = useMemo(() => {
    return initialMembers
      .map((m: Member, idx: number): Member => ({
        userId: m.userId || `member-${idx}`,
        userName: m.userName || 'Team Member',
        userEmail: canSeeEmail ? (m.userEmail || '') : '',
        userRole: m.userRole || 'Member',
        userStatus: m.userStatus || 'ACTIVE',
        jobTitle: m.jobTitle || '',
        createdAt: m.createdAt ? String(m.createdAt).split('T')[0] : '2026-03-01',
        avatarUrl: m.avatarUrl || '',
        isSuperAdmin: m.isSuperAdmin,
        userCode: m.userCode || '',
      }))
      .filter((member) => {
        const matchesRole = roleFilter === 'ALL' || member.userRole === roleFilter;
        const matchesStatus = statusFilter === 'ALL' || member.userStatus === statusFilter;
        const matchesSearch =
          !globalFilter ||
          member.userName.toLowerCase().includes(globalFilter.toLowerCase()) ||
          (canSeeEmail && member.userEmail.toLowerCase().includes(globalFilter.toLowerCase())) ||
          (member.jobTitle && member.jobTitle.toLowerCase().includes(globalFilter.toLowerCase()));
        return matchesRole && matchesStatus && matchesSearch;
      });
  }, [initialMembers, roleFilter, statusFilter, globalFilter, canSeeEmail]);

  const columns = useMemo(
    () =>
      getDashboardMemberColumns({
        isTopAdmin,
        currentUser: user,
        canSeeEmail,
        onEdit: setEditingMember,
        onDelete: setDeletingMember,
      }),
    [isTopAdmin, user, canSeeEmail]
  );

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
              className="appearance-none h-10 rounded-sm border border-border/80 bg-card pl-8 pr-10 text-xs font-medium text-foreground focus:border-emerald-500 transition-all cursor-pointer shadow-xs"
            >
              <option value="ALL">All Roles</option>
              <option value="SuperAdmin">SuperAdmin</option>
              <option value="Admin">Admin</option>
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
              className="appearance-none h-10 rounded-sm border border-border/80 bg-card px-3 pr-10 text-xs font-medium text-foreground focus:border-emerald-500 transition-all cursor-pointer shadow-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DEACTIVATED">DEACTIVATED</option>
            </select>
            <div className="absolute right-0 top-0 bottom-0 flex items-center justify-center px-2 pointer-events-none border-l border-emerald-500/30">
              <ChevronDown size={14} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>

          {/* Job Titles Manager Button (TopAdmin Only) */}
          {isTopAdmin && (
            <button
              onClick={() => navigate('/organization/work-roles')}
              className="h-10 px-3 rounded-md border border-border/80 bg-card hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Manage Organization Work Roles"
            >
              <Briefcase size={14} className="text-emerald-500" />
              <span className="hidden sm:inline">Work Roles</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Table via shared DataTable component with resizable columns & unified pagination */}
      <DataTable
        columns={columns}
        data={filteredData}
        keyExtractor={(m) => m.userId}
        emptyMessage="No organization members found matching your search."
        pageSize={5}
        pageSizeOptions={[5, 10, 20, 50]}
      />

      {/* Edit Modal */}
      <EditMemberModal
        key={editingMember?.userId}
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
    </div>
  );
};
