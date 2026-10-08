import React from 'react';
import { Mic, MicOff, Shield, User, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { getMemberId } from '@/components/members/member-utils';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

interface MeetingParticipantsProps {
  participants: MeetingParticipant[];
  /** Only a host or moderator may change permissions. */
  canManage: boolean;
  onEditSettings: (participant: MeetingParticipant) => void;
  currentUserId?: string;
  currentUserName?: string;
}

export const MeetingParticipants: React.FC<MeetingParticipantsProps> = ({
  participants,
  canManage,
  onEditSettings,
  currentUserId,
  currentUserName,
}) => {
  const { user } = useAuth();
  const { members: orgMembers } = useOrganization();

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

        const isMuted = !participant.canSendAudio;

        return (
          <li
            key={`${uId}-${index}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-muted-foreground border border-border">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="size-full object-cover" />
                ) : role === 'HOST' ? (
                  <Crown size={15} className="text-amber-500" />
                ) : (
                  <User size={15} />
                )}
              </span>

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

            {/* Active audio status icon ONLY */}
            <div className="flex items-center gap-2 shrink-0">
              <span title={isMuted ? 'Muted' : 'Microphone Active'}>
                {isMuted ? (
                  <MicOff size={15} className="text-red-500" />
                ) : (
                  <Mic size={15} className="text-emerald-500" />
                )}
              </span>

              {canManage && !isYou && (
                <Button variant="outline" size="xs" onClick={() => onEditSettings(participant)}>
                  Settings
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
