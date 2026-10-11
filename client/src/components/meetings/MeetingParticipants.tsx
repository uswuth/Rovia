import React from 'react';
import {
  Mic,
  MicOff,
  Shield,
  MoreVertical,
  Settings,
  UserMinus,
  MonitorOff,
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

interface MeetingParticipantsProps {
  participants: MeetingParticipant[];
  /** Only a host or moderator may change permissions. */
  canManage: boolean;
  isHost?: boolean;
  onEditSettings: (participant: MeetingParticipant) => void;
  currentUserId?: string;
  currentUserName?: string;
  activeScreenShareUserId?: string;
  onToggleMuteParticipant?: (participant: MeetingParticipant) => void;
  onEndParticipantScreenShare?: (userId: string) => void;
  onRemoveParticipant?: (userId: string) => void;
  localMicOn?: boolean;
  peers?: Record<string, { audioEnabled?: boolean; videoEnabled?: boolean }>;
}

export const MeetingParticipants: React.FC<MeetingParticipantsProps> = ({
  participants,
  canManage,
  isHost,
  onEditSettings,
  currentUserId,
  currentUserName,
  activeScreenShareUserId,
  onToggleMuteParticipant,
  onEndParticipantScreenShare,
  onRemoveParticipant,
  localMicOn,
  peers,
}) => {
  const { user } = useAuth();
  const { members: orgMembers } = useOrganization();
  const hasHostPrivilege = isHost !== undefined ? isHost : canManage;

  // Filter out participants who have left
  const activeParticipants = (participants ?? []).filter(
    (p) => (p?.participantStatus || (p as unknown as Record<string, string>)?.participant_status) !== 'LEFT'
  );

  if (activeParticipants.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
        No active participants connected.
      </p>
    );
  }

  return (
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
        const isScreenSharing = activeScreenShareUserId === uId || Boolean(participant.canShareScreen && participant.canSendVideo);

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

                    {isScreenSharing && (
                      <DropdownMenuItem
                        onClick={() => onEndParticipantScreenShare?.(uId)}
                        className="cursor-pointer gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium"
                      >
                        <MonitorOff size={14} className="text-amber-500 shrink-0" />
                        <span>End Screen Sharing</span>
                      </DropdownMenuItem>
                    )}

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
  );
};
