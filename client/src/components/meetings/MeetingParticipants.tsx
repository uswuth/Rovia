import React from 'react';
import {
  Mic,
  MicOff,
  Shield,
  MoreVertical,
  Settings,
  UserMinus,
  Hand,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { getMemberId } from '@/components/members/member-utils';
import { cn } from '@/lib/utils';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';
import type { RaisedHand } from '@/api/meeting/webrtc.types';

interface MeetingParticipantsProps {
  participants: MeetingParticipant[];
  /** Only a host or moderator may change permissions. */
  canManage: boolean;
  isHost?: boolean;
  onEditSettings: (participant: MeetingParticipant) => void;
  currentUserId?: string;
  currentUserName?: string;
  onToggleMuteParticipant?: (participant: MeetingParticipant) => void;
  onRemoveParticipant?: (userId: string) => void;
  localMicOn?: boolean;
  peers?: Record<string, { audioEnabled?: boolean; videoEnabled?: boolean }>;
  raisedHands?: RaisedHand[];
  onLowerHand?: (userId?: string) => void;
}

export const MeetingParticipants: React.FC<MeetingParticipantsProps> = ({
  participants,
  canManage,
  isHost,
  onEditSettings,
  currentUserId,
  currentUserName,
  onToggleMuteParticipant,
  onRemoveParticipant,
  localMicOn,
  peers,
  raisedHands = [],
  onLowerHand,
}) => {
  const { user } = useAuth();
  const { members: orgMembers } = useOrganization();
  const hasHostPrivilege = isHost !== undefined ? isHost : canManage;

  const [showAllHands, setShowAllHands] = React.useState(false);
  const displayedHands = showAllHands ? raisedHands : raisedHands.slice(0, 3);
  const hiddenHandsCount = Math.max(0, raisedHands.length - 3);

  // Filter out participants who have left
  const activeParticipants = (participants ?? []).filter(
    (p) => (p?.participantStatus || (p as unknown as Record<string, string>)?.participant_status) !== 'LEFT'
  );

  return (
    <div className="space-y-4">
      {}
      {raisedHands.length > 0 && (
        <div className="rounded-xs border border-border/80 bg-card p-3 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Hand size={14} className="text-accent-foreground" />
              <span className="text-xs font-bold text-foreground">Raised Hands</span>
              <Badge tone="neutral" className="text-[10px] px-1.5 py-0 rounded-full font-semibold">
                {raisedHands.length}
              </Badge>
            </div>
            {hasHostPrivilege && (
              <button
                type="button"
                onClick={() => onLowerHand?.('all')}
                className="text-[10px] font-medium text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded-sm hover:bg-muted transition-colors cursor-pointer"
              >
                Lower all
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {displayedHands.map((item, index) => {
              const isYou = item.userId === currentUserId || item.userId === user?.userId;
              const rank = index + 1;
              const name = isYou ? 'You' : item.userName || 'Member';
              const initial = name.charAt(0).toUpperCase() || 'U';

              const levelBg =
                rank === 1
                  ? 'bg-accent/20 border-accent/40 shadow-xs'
                  : rank === 2
                    ? 'bg-accent/12 border-accent/25'
                    : rank === 3
                      ? 'bg-accent/6 border-accent/15'
                      : 'bg-muted/40 border-border/40';

              const badgeTone =
                rank === 1
                  ? 'bg-accent text-accent-foreground font-black'
                  : rank === 2
                    ? 'bg-accent/80 text-accent-foreground font-bold'
                    : rank === 3
                      ? 'bg-accent/60 text-accent-foreground font-semibold'
                      : 'bg-muted text-muted-foreground font-medium';

              return (
                <div
                  key={item.userId}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-md border text-xs transition-colors',
                    levelBg
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('size-5 flex items-center justify-center rounded-full text-[10px] shrink-0', badgeTone)}>
                      #{rank}
                    </span>
                    <Avatar className="size-6 text-[9px] shrink-0">
                      <AvatarFallback name={name} className={cn('text-[9px] font-bold', getAvatarColorByName(name))}>
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium text-foreground text-xs leading-tight">
                        {name} {isYou && <span className="text-[10px] text-muted-foreground font-normal">(You)</span>}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {rank === 1 ? 'First in order' : rank === 2 ? 'Second in order' : rank === 3 ? 'Third in order' : `${rank}th in order`}
                      </span>
                    </div>
                  </div>

                  {(hasHostPrivilege || isYou) && (
                    <button
                      type="button"
                      onClick={() => onLowerHand?.(item.userId)}
                      className="text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-sm bg-background/80 hover:bg-background border border-border/50 shrink-0 cursor-pointer shadow-2xs transition-colors"
                    >
                      Lower
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {hiddenHandsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllHands((v) => !v)}
              className="w-full text-center py-1 text-[11px] font-semibold text-accent-foreground hover:bg-accent/10 rounded-md transition-colors cursor-pointer"
            >
              {showAllHands ? 'Show top 3 only' : `+${hiddenHandsCount} more in queue (show all ${raisedHands.length})`}
            </button>
          )}
        </div>
      )}

      {activeParticipants.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
          No active participants connected.
        </p>
      ) : (
        <ul className="space-y-2">
          {activeParticipants.map((participant, index) => {
            const uId = participant?.userId || (participant as unknown as Record<string, string>)?.user_id || `User-${index}`;
            const role = participant?.participantRole || (participant as unknown as Record<string, string>)?.participant_role || 'MEMBER';
            const isYou = uId === currentUserId || uId === user?.userId;

            // Resolve clean display name instead of raw Mongo/UUID hex string
            let displayName = (participant as unknown as Record<string, string>)?.userName ||
              (participant as unknown as Record<string, string>)?.name ||
              (isYou ? (currentUserName || user?.userName || 'You') : '');

            let avatarUrl = participant.avatarUrl || (participant as unknown as Record<string, string>)?.avatar || (isYou ? user?.avatarUrl : '');
            if (!displayName && orgMembers) {
              const matched = orgMembers.find((m) => getMemberId(m) === uId);
              if (matched) {
                displayName = matched.userName || matched.userEmail;
                if (!avatarUrl) avatarUrl = matched.avatarUrl || '';
              }
            }

            if (!displayName) {
              displayName = uId.length > 20 ? `Participant (${uId.slice(-4)})` : uId;
            }

            const isMuted = isYou
              ? !(localMicOn ?? true)
              : (!participant.canSendAudio || peers?.[uId]?.audioEnabled === false);

            return (
              <li
                key={`${uId}-${index}`}
                className="group relative flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs hover:border-emerald-500/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar className="size-8 shrink-0">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback name={displayName} className={cn("text-xs font-bold", getAvatarColorByName(displayName))}>
                      {displayName.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {displayName} {isYou ? '(You)' : ''}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {role !== 'MEMBER' && (
                        <Badge tone="accent" className="text-[10px] py-0 px-1.5">
                          <Shield size={9} />
                          {(role || '').toLowerCase()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Active audio status icon & Hover actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip content={hasHostPrivilege || isYou ? (isMuted ? 'Click to unmute' : 'Click to mute') : (isMuted ? 'Muted' : 'Microphone Active')} side="left">
                    <button
                      type="button"
                      disabled={!hasHostPrivilege && !isYou}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasHostPrivilege || isYou) {
                          onToggleMuteParticipant?.(participant);
                        }
                      }}
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-xs transition-colors",
                        (hasHostPrivilege || isYou)
                          ? "cursor-pointer hover:bg-secondary text-muted-foreground hover:text-foreground"
                          : "cursor-default"
                      )}
                      aria-label={isMuted ? `Unmute ${displayName}` : `Mute ${displayName}`}
                    >
                      {isMuted ? (
                        <MicOff size={14} className="text-red-500" />
                      ) : (
                        <Mic size={14} className="text-emerald-500" />
                      )}
                    </button>
                  </Tooltip>

                  {hasHostPrivilege && !isYou ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <button
                            type="button"
                            className="flex size-6 shrink-0 items-center justify-center rounded-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                            aria-label={`Actions for ${displayName}`}
                          >
                            <MoreVertical size={14} />
                          </button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-52 p-1.5 space-y-1">
                        <DropdownMenuLabel className="flex items-center justify-between border-b border-border pb-1.5 mb-1 px-2">
                          <span className="truncate font-semibold text-foreground text-xs">{displayName}</span>
                          <Badge tone="accent" className="text-[9px] py-0 px-1 shrink-0 ml-1">
                            {(role || 'Member').toLowerCase()}
                          </Badge>
                        </DropdownMenuLabel>

                        <DropdownMenuItem onClick={() => onEditSettings(participant)} className="cursor-pointer gap-2 text-xs">
                          <Settings size={14} className="text-muted-foreground shrink-0" />
                          <span>Permissions & Settings</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => onToggleMuteParticipant?.(participant)} className="cursor-pointer gap-2 text-xs">
                          {isMuted ? (
                            <>
                              <Mic size={14} className="text-emerald-500 shrink-0" />
                              <span>Unmute Participant</span>
                            </>
                          ) : (
                            <>
                              <MicOff size={14} className="text-amber-500 shrink-0" />
                              <span>Mute / Deafen</span>
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuSeparator className="my-1" />

                        <DropdownMenuItem
                          onClick={() => onRemoveParticipant?.(uId)}
                          variant="destructive"
                          className="cursor-pointer gap-2 text-xs text-red-500 focus:text-red-600"
                        >
                          <UserMinus size={14} className="shrink-0" />
                          <span>Remove from Meeting</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <div className="size-6 shrink-0" aria-hidden="true" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
