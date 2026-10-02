import { Mic, MicOff, Video, VideoOff, MonitorUp, MessageSquare, Shield, User, Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MeetingParticipant } from '@/api/meeting/meeting.types';

interface MeetingParticipantsProps {
  participants: MeetingParticipant[];
  /** Only a host or moderator may change permissions. */
  canManage: boolean;
  onEditSettings: (participant: MeetingParticipant) => void;
}

/**
 * Roster with each member's live capabilities. Icons are bare and convey state
 * directly: a struck-through mic means the host has disabled it for them.
 */
export const MeetingParticipants = ({
  participants,
  canManage,
  onEditSettings,
}: MeetingParticipantsProps) => {
  if (participants.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card p-4 text-xs text-muted-foreground">
        No participants yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {(participants ?? []).map((participant, index) => {
        const uId = participant?.userId || (participant as unknown as Record<string, string>)?.user_id || `User-${index}`;
        const role = participant?.participantRole || (participant as unknown as Record<string, string>)?.participant_role || 'MEMBER';
        const status = participant?.participantStatus || (participant as unknown as Record<string, string>)?.participant_status || 'INVITED';

        return (
          <li
            key={uId}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              {role === 'HOST' ? (
                <Crown size={14} strokeWidth={1.75} />
              ) : (
                <User size={14} strokeWidth={1.75} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {uId}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={status === 'JOINED' ? 'success' : 'neutral'}>
                  {(status || '').toLowerCase()}
                </Badge>
                {role !== 'MEMBER' && (
                  <Badge tone="accent">
                    <Shield size={10} />
                    {(role || '').toLowerCase()}
                  </Badge>
                )}
              </div>
            </div>

          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span title={participant.canSendAudio ? 'Microphone allowed' : 'Microphone disabled'}>
              {participant.canSendAudio ? (
                <Mic size={14} strokeWidth={1.75} />
              ) : (
                <MicOff size={14} strokeWidth={1.75} className="text-destructive" />
              )}
            </span>
            <span title={participant.canSendVideo ? 'Camera allowed' : 'Camera disabled'}>
              {participant.canSendVideo ? (
                <Video size={14} strokeWidth={1.75} />
              ) : (
                <VideoOff size={14} strokeWidth={1.75} className="text-destructive" />
              )}
            </span>
            <span title={participant.canShareScreen ? 'Screen share allowed' : 'Screen share disabled'}>
              <MonitorUp
                size={14}
                strokeWidth={1.75}
                className={participant.canShareScreen ? undefined : 'text-destructive'}
              />
            </span>
            <span title={participant.canUseChat ? 'Chat allowed' : 'Chat disabled'}>
              <MessageSquare
                size={14}
                strokeWidth={1.75}
                className={participant.canUseChat ? undefined : 'text-destructive'}
              />
            </span>
          </div>

          {canManage && (
            <Button variant="outline" size="sm" onClick={() => onEditSettings(participant)}>
              Settings
            </Button>
          )}
        </li>
      );
    })}
  </ul>
  );
};

