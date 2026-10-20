import React, { useState, useMemo } from 'react';
import { Users, Search, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import type { Member } from '@/types/member.types';
import { getMemberId, getRoleCategory, normalizeMemberList } from './member-utils';
import { getUserStatusTone } from '@/lib/status-tone';

export interface RosterDetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  projectName?: string;
  teamName?: string;
  members: Member[];
  value?: Record<string, 'Host' | 'Member'>;
  onUpdateRole?: (memberId: string, role: 'Host' | 'Member') => void;
  onRemoveMember?: (memberId: string) => void;
  canManage?: boolean;
}

export const RosterDetailModal: React.FC<RosterDetailModalProps> = ({
  open,
  onClose,
  title,
  projectName,
  teamName,
  members = [],
  value = {},
}) => {
  const [search, setSearch] = useState('');

  const deduplicatedMembers = useMemo(() => {
    return normalizeMemberList(members);
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deduplicatedMembers;
    return deduplicatedMembers.filter((m) => {
      const name = m.userName || '';
      const email = m.userEmail || '';
      const role = m.userRole || '';
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || role.toLowerCase().includes(q);
    });
  }, [deduplicatedMembers, search]);

  const columns: Column<Member>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: (m) => {
        const name = m.userName || m.userEmail || 'Member';
        const email = m.userEmail || '';
        return (
          <div className="flex items-center gap-2.5 min-w-[180px]">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/30">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{name}</p>
              {email && <p className="text-[11px] text-muted-foreground truncate">{email}</p>}
            </div>
          </div>
        );
      },
    },
    {
      id: 'projectContext',
      header: 'Context',
      width: '150px',
      cell: () => (
        <div className="space-y-0.5 text-xs">
          {projectName && (
            <p className="font-medium text-foreground truncate">{projectName}</p>
          )}
          {teamName && (
            <p className="text-[11px] text-muted-foreground truncate font-mono">{teamName}</p>
          )}
          {!projectName && !teamName && (
            <span className="text-muted-foreground/60 italic text-[11px]">Workspace Roster</span>
          )}
        </div>
      ),
    },
    {
      id: 'systemRole',
      header: 'System Role',
      width: '120px',
      cell: (m) => {
        const cat = getRoleCategory(m);
        if (cat === 'SUPER_ADMIN') {
          return <Badge tone="success">SuperAdmin</Badge>;
        }
        if (cat === 'ADMIN') {
          return <Badge tone="info">Admin</Badge>;
        }
        return <Badge tone="neutral">{m.userRole || 'Member'}</Badge>;
      },
    },
    {
      id: 'assignedRole',
      header: 'Assigned Role',
      width: '130px',
      cell: (m) => {
        const mId = getMemberId(m);
        const cat = getRoleCategory(m);
        const isTop = cat === 'SUPER_ADMIN' || cat === 'ADMIN';
        const role = isTop ? 'Host' : (value[mId] || 'Member');

        return (
          <div className="flex items-center gap-1.5">
            {role === 'Host' ? (
              <Badge tone="success" className="gap-1">
                <ShieldCheck size={11} />
                <span>Host</span>
              </Badge>
            ) : (
              <Badge tone="neutral">Member</Badge>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '110px',
      cell: (m) => {
        const st = m.userStatus || 'ACTIVE';
        return <Badge tone={getUserStatusTone(st)}>{st}</Badge>;
      },
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className="w-[95vw] sm:w-[88vw] lg:w-[80vw] max-w-6xl min-w-[320px] sm:min-w-[640px] lg:min-w-[850px]"
    >
      <div className="space-y-4">
        {/* Filter and stats row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter roster members by name, email, or role..."
              className="pl-8 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Badge tone="success" className="gap-1">
              <Users size={12} />
              <span>{deduplicatedMembers.length} Members Total</span>
            </Badge>
          </div>
        </div>

        {/* Member Table */}
        <DataTable
          columns={columns}
          data={filteredMembers}
          keyExtractor={(m) => getMemberId(m)}
          pageSize={5}
          pageSizeOptions={[5, 10, 20]}
        />

        {/* Footer info */}
        <div className="flex items-center justify-end text-xs text-muted-foreground">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
