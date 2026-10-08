import React, { useState, useMemo } from 'react';
import { Users, Search, UserMinus, ShieldCheck, Check } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Member } from '@/types/member.types';
import { useAuth } from '@/context/AuthContext';
import { getMemberId, getRoleCategory } from './member-utils';
import { getUserStatusTone } from '@/lib/status-tone';
import { useScrollFade } from '@/hooks/useScrollFade';

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
  onUpdateRole,
  onRemoveMember,
  canManage,
}) => {
  const { user } = useAuth();
  const isTopAdmin = Boolean(
    user?.isSuperAdmin ||
    ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes((user?.userRole || '').toUpperCase())
  );
  const isHost = (user?.userRole || '').toUpperCase() === 'HOST';
  const canModify = canManage !== undefined ? canManage : (isTopAdmin || isHost);

  const scrollRef = useScrollFade<HTMLDivElement>();
  const [search, setSearch] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = m.userName || '';
      const email = m.userEmail || '';
      const role = m.userRole || '';
      return name.toLowerCase().includes(q) || email.toLowerCase().includes(q) || role.toLowerCase().includes(q);
    });
  }, [members, search]);

  const columns: Column<Member>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: (m) => {
        const name = m.userName || m.userEmail || 'Member';
        const email = m.userEmail || '';
        return (
          <div className="flex items-center gap-2.5 min-w-[180px]">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
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
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: '130px',
      cell: (m) => {
        const mId = getMemberId(m);
        const cat = getRoleCategory(m);
        const isTop = cat === 'SUPER_ADMIN' || cat === 'ADMIN';

        if (isTop) {
          return (
            <div className="flex justify-end items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1 cursor-default">
                    <Check size={12} />
                    <span>Locked Host</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left">Admins & SuperAdmins are locked as Hosts</TooltipContent>
              </Tooltip>
            </div>
          );
        }

        if (!canModify) {
          return <span className="text-[11px] text-muted-foreground/50 italic">Read Only</span>;
        }

        const currentRole = value[mId] || 'Member';

        return (
          <div className="flex items-center justify-end gap-1.5">
            {onUpdateRole && (
              <div className="flex items-center gap-1 bg-background/80 rounded-md p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => onUpdateRole(mId, 'Member')}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-colors cursor-pointer ${currentRole === 'Member'
                      ? 'bg-emerald-500 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Member
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateRole(mId, 'Host')}
                  className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-colors cursor-pointer ${currentRole === 'Host'
                      ? 'bg-emerald-500 text-white'
                      : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  Host
                </button>
              </div>
            )}

            {onRemoveMember && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMemberToRemove({ id: mId, name: m.userName || m.userEmail || 'Member' })}
                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                title="Remove Member"
              >
                <UserMinus size={14} />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={`Viewing full roster details for ${projectName || teamName || 'workspace'}. Authorized updates are saved instantly.`}
      className="max-w-4xl"
    >
      <div className="space-y-4">
        {/* Filter and stats row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
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
              <span>{members.length} Members Total</span>
            </Badge>
          </div>
        </div>

        {/* Member Table */}
        <div ref={scrollRef} className="max-h-[420px] overflow-y-auto scroll-fade-y rounded-md border border-border">
          <DataTable
            columns={columns}
            data={filteredMembers}
            keyExtractor={(m) => getMemberId(m)}
          />
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border">
          <p className="text-[11px]">
            {isTopAdmin ? 'SuperAdmin & Admin privileges active: You may adjust host assignments or remove team members.' : 'Viewing in read-only mode.'}
          </p>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(memberToRemove)}
        onOpenChange={(op) => !op && setMemberToRemove(null)}
        title="Remove Member from Roster"
        description={
          <>
            Are you sure you want to remove <span className="font-semibold text-foreground">{memberToRemove?.name}</span> from{' '}
            <span className="font-semibold text-foreground">{projectName || teamName || 'this roster'}</span>?
          </>
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (memberToRemove && onRemoveMember) {
            onRemoveMember(memberToRemove.id);
            setMemberToRemove(null);
          }
        }}
        variant="destructive"
      />
    </Modal>
  );
};
