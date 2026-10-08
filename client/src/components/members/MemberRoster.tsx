import React, { useState } from 'react';
import { Users, Check, UserPlus, UserMinus, Trash2Icon, AlertTriangle, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { Member } from '@/types/member.types';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { getMemberId, isTopAdminRole, getRoleCategory } from '@/components/members/member-utils';
import { useScrollFade } from '@/hooks/useScrollFade';

export interface MemberRosterProps {
  /** The full pool of organization members available to select from */
  members: Member[];
  /** Map of member ID -> role ('Host' | 'Member') */
  value: Record<string, 'Host' | 'Member'>;
  /** Callback when roster assignments change */
  onChange: (value: Record<string, 'Host' | 'Member'>) => void;
  /** Panel title */
  title?: string;
  /** Singular entity noun for dialogs/tooltips (e.g. "project", "meeting") */
  entityName?: string;
  /** Whether SuperAdmins are permanently locked as Host */
  lockSuperAdmin?: boolean;
  /** Optional class name on outer container */
  className?: string;
  /** Optional min-height for scroll area */
  minHeight?: string;
  /** Name of the project or meeting to mention in confirmation dialogs */
  projectName?: string;
  /** Maximum number of hosts allowed (default: 3) */
  maxHosts?: number;
  /** Override permission to manage roster (assign/remove/toggle). Defaults to true for TopAdmins and Hosts. */
  canManage?: boolean;
  /** Override permission to view emails. Defaults to true only for Admin / SuperAdmin. */
  canViewEmail?: boolean;
  /** Optional placeholder text for member search input */
  searchPlaceholder?: string;
}

export const MemberRoster: React.FC<MemberRosterProps> = ({
  members = [],
  value = {},
  onChange,
  title = 'Project Members & Roles',
  entityName = 'project',
  lockSuperAdmin = true,
  className,
  minHeight = '380px',
  projectName,
  maxHosts = 3,
  canManage,
  canViewEmail,
  searchPlaceholder = 'Search members by name or email...',
}) => {
  const { user } = useAuth();
  const isTopAdmin = Boolean(
    user?.isSuperAdmin ||
    ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes((user?.userRole || '').toUpperCase())
  );
  const isHost = (user?.userRole || '').toUpperCase() === 'HOST';
  const isVisitor = (user?.userRole || '').toUpperCase() === 'VISITOR';

  // Members, Hosts, Admins, and SuperAdmins CAN see emails; only Visitors CANNOT
  const canSeeEmail = canViewEmail !== undefined ? canViewEmail : !isVisitor;
  // The Visitor role tag is ONLY seen by Host, Admin, and SuperAdmin; NOT Member or Visitor
  const canSeeVisitorRole = isTopAdmin || isHost;
  // Only TopAdmin or Host can manage the roster; regular Members and Visitors have read-only view
  const canModifyRoster = canManage !== undefined ? canManage : (isTopAdmin || isHost);

  const scrollRef = useScrollFade<HTMLDivElement>();
  const [memberSearch, setMemberSearch] = useState('');
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removeAnchorRect, setRemoveAnchorRect] = useState<DOMRect | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const warningTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTextRef = React.useRef<HTMLSpanElement>(null);
  const warningContainerRef = React.useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  const showWarning = (msg: string) => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setScrollOffset(0);
    setWarningMessage(msg);
    warningTimerRef.current = setTimeout(() => {
      setWarningMessage(null);
      setScrollOffset(0);
    }, 6000);
  };

  React.useEffect(() => {
    if (!warningMessage) return;

    const checkOverflow = () => {
      if (warningTextRef.current && warningContainerRef.current) {
        const textWidth = warningTextRef.current.scrollWidth;
        const containerWidth = warningContainerRef.current.clientWidth;
        const diff = textWidth - containerWidth;
        setScrollOffset(diff > 4 ? diff : 0);
      }
    };

    const rafId = requestAnimationFrame(checkOverflow);
    window.addEventListener('resize', checkOverflow);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [warningMessage]);

  React.useEffect(() => {
    return () => {
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!lockSuperAdmin) return;
    const topAdmins = members.filter(isTopAdminRole);
    let updated = false;
    const copy = { ...value };
    topAdmins.forEach((m) => {
      const mId = getMemberId(m);
      if (mId && copy[mId] !== 'Host') {
        copy[mId] = 'Host';
        updated = true;
      }
    });
    if (updated) {
      onChange(copy);
    }
  }, [members, lockSuperAdmin]);

  const topAdminIds = new Set(
    members.filter(isTopAdminRole).map(getMemberId)
  );

  const memberHostCount = Object.entries(value).filter(
    ([mId, role]) => role === 'Host' && !topAdminIds.has(mId)
  ).length;

  const filteredMembers = members.filter((m) => {
    const name = m.userName || '';
    const email = canSeeEmail ? (m.userEmail || '') : '';
    const query = memberSearch.toLowerCase();
    return name.toLowerCase().includes(query) || (canSeeEmail && email.toLowerCase().includes(query));
  });

  const entityTitle = entityName.charAt(0).toUpperCase() + entityName.slice(1);

  const groupedMembers: Record<string, Member[]> = {
    'Super Admin': filteredMembers.filter((m) => getRoleCategory(m) === 'SUPER_ADMIN'),
    'Admins': filteredMembers.filter((m) => getRoleCategory(m) === 'ADMIN'),
    [`${entityTitle} Hosts`]: filteredMembers.filter(
      (m) => !isTopAdminRole(m) && getRoleCategory(m) !== 'VISITORS' && value[getMemberId(m)] === 'Host',
    ),
    [`${entityTitle} Members`]: filteredMembers.filter(
      (m) => !isTopAdminRole(m) && getRoleCategory(m) !== 'VISITORS' && value[getMemberId(m)] === 'Member',
    ),
    ...(canSeeVisitorRole
      ? {
          'Webinar Visitors': filteredMembers.filter((m) => getRoleCategory(m) === 'VISITORS'),
        }
      : {}),
    'Available Team Members': filteredMembers.filter(
      (m) => !isTopAdminRole(m) && (canSeeVisitorRole ? getRoleCategory(m) !== 'VISITORS' : true) && !value[getMemberId(m)],
    ),
  };

  const selectedCount = Object.keys(value).length;

  const toggleMemberSelection = (memberId: string, isSuperAdmin: boolean = false) => {
    if (!canModifyRoster) return;
    if (topAdminIds.has(memberId) && lockSuperAdmin) return;
    if (!isTopAdmin && topAdminIds.has(memberId)) return;

    const copy = { ...value };
    if (copy[memberId]) {
      // Opening confirmation dialog before removing
      const member = members.find((m) => getMemberId(m) === memberId);
      const displayName = member?.userName || member?.userEmail || 'Member';
      setMemberToRemove({ id: memberId, name: displayName });
    } else {
      copy[memberId] = 'Member';
      onChange(copy);
    }
  };

  const canAssignRole = (memberId: string): boolean =>
    canModifyRoster && (isTopAdmin || !topAdminIds.has(memberId));

  const applyMemberRole = (memberId: string, role: 'Host' | 'Member') => {
    onChange({
      ...value,
      [memberId]: role,
    });
  };

  const handleConfirmRemoval = () => {
    if (!memberToRemove) return;
    const copy = { ...value };
    delete copy[memberToRemove.id];
    onChange(copy);
    setMemberToRemove(null);
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-xl border border-border bg-card/60 p-4.5 space-y-3 shadow-xs',
        className,
      )}
    >
      {/* Header with counter */}
      <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-emerald-500" />
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
        </div>
        <Badge tone={selectedCount > 0 ? 'success' : 'neutral'}>
          {selectedCount} Selected
        </Badge>
      </div>

      {/* Search Input */}
      <Input
        value={memberSearch}
        onChange={(e) => setMemberSearch(e.target.value)}
        placeholder={searchPlaceholder}
        className="text-xs shrink-0"
      />

      {/* Host limit warning notification */}
      {warningMessage && (
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400 backdrop-blur-md shadow-xs animate-in fade-in duration-200 shrink-0 overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <AlertTriangle size={15} className="shrink-0 text-amber-500" />
            <div
              ref={warningContainerRef}
              className="min-w-0 flex-1 overflow-hidden"
              title={warningMessage}
            >
              <span
                ref={warningTextRef}
                className={cn(
                  'font-medium inline-block whitespace-nowrap',
                  scrollOffset > 0 && 'animate-ticker'
                )}
                style={
                  scrollOffset > 0
                    ? ({
                        '--scroll-offset': `-${scrollOffset + 10}px`,
                        '--ticker-duration': `${Math.max(6, Math.min(15, (scrollOffset / 25) + 4))}s`,
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {warningMessage}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWarningMessage(null)}
            className="text-amber-600 dark:text-amber-400 hover:text-foreground p-0.5 rounded cursor-pointer shrink-0 transition-colors z-10"
            aria-label="Dismiss alert"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Scrollable Grouped Members List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-fade-y space-y-4 pr-1"
        style={{ minHeight }}
      >
        {filteredMembers.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            {memberSearch ? 'No team members match your search.' : 'No team members found in workspace.'}
          </div>
        ) : (
          Object.entries(groupedMembers).map(([categoryLabel, groupList]) => {
            if (groupList.length === 0) return null;

            return (
              <div key={categoryLabel} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase font-mono">
                    {categoryLabel} — {groupList.length}
                    {categoryLabel.toLowerCase().includes('host') && ` / ${maxHosts} max`}
                  </span>
                  {categoryLabel.toLowerCase().includes('host') && memberHostCount >= maxHosts && (
                    <span className="text-[9px] font-medium text-amber-500 font-mono">
                      Limit reached
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {groupList.map((member: Member) => {
                    const memberId = getMemberId(member);
                    const memberCat = getRoleCategory(member);
                    const isSuperAdmin = memberCat === 'SUPER_ADMIN';
                    const isAdmin = memberCat === 'ADMIN';
                    const currentRole = value[memberId];
                    const isSelected = Boolean(currentRole);
                    const displayName = member.userName || member.userEmail || 'Unknown';
                    const displayEmail = member.userEmail || '';

                    return (
                      <div
                        key={memberId}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-lg border transition-all',
                          isSuperAdmin
                            ? 'border-emerald-500/50 bg-emerald-500/10'
                            : isSelected
                            ? 'border-emerald-500/50 bg-emerald-500/10 shadow-xs'
                            : 'border-border/60 bg-background/50 hover:border-border',
                        )}
                      >
                        {/* Member Avatar & Details */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-500/30">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                              {member.jobTitle && (
                                <span className="inline-flex shrink-0 items-center rounded-xs bg-muted px-1 py-0.2 text-[10px] font-medium text-muted-foreground border border-border/50">
                                  {member.jobTitle}
                                </span>
                              )}
                            </div>
                            {canSeeEmail ? (
                              <p className="text-[11px] text-muted-foreground truncate">{displayEmail || 'No email'}</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground/70 truncate capitalize font-mono">
                                {getRoleCategory(member).toLowerCase().replace('_', ' ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Right side controls: Role toggles and selection buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!canModifyRoster ? (
                            /* Read-only view for regular Members and Visitors */
                            <div className="flex items-center gap-1.5">
                              {isSuperAdmin ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                                  SuperAdmin
                                </span>
                              ) : isAdmin ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                  Admin
                                </span>
                              ) : getRoleCategory(member) === 'VISITORS' ? (
                                canSeeVisitorRole ? (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                    Visitor
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-secondary text-secondary-foreground border border-border">
                                    Attendee
                                  </span>
                                )
                              ) : isSelected ? (
                                currentRole === 'Host' ? (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                    Host
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-secondary text-secondary-foreground border border-border">
                                    Member
                                  </span>
                                )
                              ) : (
                                <span className="text-[10px] text-muted-foreground/50 font-mono italic">
                                  Available
                                </span>
                              )}
                            </div>
                          ) : (lockSuperAdmin && isSuperAdmin) ? (
                            <>
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                                SuperAdmin
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled
                                    className="w-7 h-7 rounded-full flex items-center justify-center bg-emerald-500 text-white cursor-default"
                                  >
                                    <Check size={14} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">SuperAdmin is locked as Host</TooltipContent>
                              </Tooltip>
                            </>
                          ) : (lockSuperAdmin && isAdmin) ? (
                            <>
                              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                Admin
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    disabled
                                    className="w-7 h-7 rounded-full flex items-center justify-center bg-purple-500 text-white cursor-default shrink-0"
                                  >
                                    <Check size={14} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left">Admin is locked as Host</TooltipContent>
                              </Tooltip>
                            </>
                          ) : (
                            /* Interactive controls for TopAdmin and Hosts on regular members */
                            <>
                              {getRoleCategory(member) === 'VISITORS' && canSeeVisitorRole ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  Visitor
                                </span>
                              ) : (
                                isSelected && (
                                  <div className="flex items-center gap-1 bg-background/80 rounded-md p-0.5 border border-border">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!canAssignRole(memberId)) return;
                                        applyMemberRole(memberId, 'Member');
                                      }}
                                      className={cn(
                                        'px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-colors cursor-pointer',
                                        currentRole === 'Member'
                                          ? 'bg-emerald-500 text-white'
                                          : 'text-muted-foreground hover:text-foreground',
                                      )}
                                    >
                                      Member
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!canAssignRole(memberId)) return;
                                        if (value[memberId] !== 'Host' && memberHostCount >= maxHosts) {
                                          showWarning(
                                            `Only ${maxHosts} member hosts are allowed per ${entityName} (Admins are exempt).`
                                          );
                                          return;
                                        }
                                        applyMemberRole(memberId, 'Host');
                                      }}
                                      className={cn(
                                        'px-1.5 py-0.5 text-[10px] font-semibold rounded-sm transition-colors cursor-pointer',
                                        currentRole === 'Host'
                                          ? 'bg-emerald-500 text-white'
                                          : !topAdminIds.has(memberId) && memberHostCount >= maxHosts
                                          ? 'text-muted-foreground/60 hover:text-amber-500'
                                          : 'text-muted-foreground hover:text-foreground',
                                      )}
                                      title={
                                        currentRole !== 'Host' && !topAdminIds.has(memberId) && memberHostCount >= maxHosts
                                          ? `Only ${maxHosts} member hosts allowed for a ${entityName}`
                                          : undefined
                                      }
                                    >
                                      Host
                                    </button>
                                  </div>
                                )
                              )}

                              {isSelected ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setRemoveAnchorRect(rect);
                                        setMemberToRemove({ id: memberId, name: displayName });
                                      }}
                                      className="w-7 h-7 rounded-full flex items-center justify-center bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 transition-colors cursor-pointer"
                                      aria-label={`Remove ${displayName} from ${entityName}`}
                                    >
                                      <UserMinus size={14} />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">Remove from {entityName}</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => toggleMemberSelection(memberId, false)}
                                      className="w-7 h-7 rounded-full flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground hover:bg-emerald-500/20 transition-colors cursor-pointer"
                                    >
                                      <UserPlus size={14} />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="left">Add to {entityName}</TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Remove Member Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(memberToRemove)}
        anchorRect={removeAnchorRect}
        onOpenChange={(open) => {
          if (!open) {
            setMemberToRemove(null);
            setRemoveAnchorRect(null);
          }
        }}
        title="Remove Member"
        description={
          <>
            Remove <span className="font-semibold text-foreground">{memberToRemove?.name}</span> from{' '}
            <span className="font-semibold text-foreground">
              {projectName || (entityName === 'project' ? 'this project' : 'this meeting')}
            </span>?
          </>
        }
        confirmLabel="Remove"
        onConfirm={handleConfirmRemoval}
        icon={<Trash2Icon size={16} />}
        variant="destructive"
      />
    </div>
  );
};
