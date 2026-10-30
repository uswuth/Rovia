import React from 'react';
import {
  Calendar,
  Clock,
  Users,
  Copy,
  Check,
  Share2,
  Sparkles,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Column } from '@/components/ui/data-table';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { formatDurationHuman } from '@/utils/duration';
import { formatCountdown } from '@/lib/format-countdown';
import type { Meeting, MeetingStatus } from '@/api/meeting/meeting.types';

export type MeetingDisplayStatus = MeetingStatus | 'IN_PROGRESS';

export function getMeetingTableColumns({
  now,
  copiedMeetingId,
  formatDateTimeStr,
  onCopyLink,
  onShareLink,
  onNavigate,
}: {
  now: number;
  copiedMeetingId: string | null;
  formatDateTimeStr: (date: Date) => string;
  onCopyLink: (joinCode: string, meetingId: string) => void;
  onShareLink: (joinCode: string, title: string) => void;
  onNavigate: (path: string) => void;
}): Column<Meeting>[] {
  return [
    {
      id: 'title',
      header: 'Meeting',
      cell: (m) => (
        <div className="flex flex-col gap-0.5 max-w-[280px]">
          <span className="font-bold text-sm text-foreground truncate">{m.meetingTitle}</span>
          {m.meetingDescription && (
            <span className="text-xs text-muted-foreground truncate">{m.meetingDescription}</span>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '120px',
      minWidth: '100px',
      cell: (m) => {
        const scheduledDate = new Date(m.meetingScheduledAt);
        const scheduledMs = scheduledDate.getTime();
        const durationMinutes = m.meetingDurationMinutes || 30;
        const earlyJoinMs = !isNaN(scheduledMs) ? scheduledMs - 5 * 60 * 1000 : 0;
        const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;
        const isPastDuration = !isNaN(scheduledMs) && now > endMs;
        const isTooEarly = !isNaN(scheduledMs) && now < earlyJoinMs;
        const isEndedOrCancelled =
          m.meetingStatus === 'ENDED' ||
          m.meetingStatus === 'CANCELLED' ||
          (m.meetingStatus !== 'LIVE' && isPastDuration);

        let statusLabel: MeetingDisplayStatus = m.meetingStatus;
        if (m.meetingStatus === 'LIVE') {
          statusLabel = 'IN_PROGRESS';
        } else if (isEndedOrCancelled) {
          statusLabel = m.meetingStatus === 'CANCELLED' ? 'CANCELLED' : 'ENDED';
        } else if (now >= earlyJoinMs && now <= endMs) {
          statusLabel = 'IN_PROGRESS';
        } else if (isTooEarly) {
          statusLabel = 'SCHEDULED';
        }

        return (
          <Badge tone={getMeetingStatusTone(statusLabel)} className="text-[10px]">
            {statusLabel}
          </Badge>
        );
      },
    },
    {
      id: 'schedule',
      header: 'Scheduled Time',
      width: '180px',
      minWidth: '150px',
      cell: (m) => {
        const scheduledDate = new Date(m.meetingScheduledAt);
        const scheduledMs = scheduledDate.getTime();
        const dateStr = !isNaN(scheduledMs) ? formatDateTimeStr(scheduledDate) : m.meetingScheduledAt;
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={13} className="text-muted-foreground shrink-0" />
            <span className="truncate">{dateStr}</span>
          </div>
        );
      },
    },
    {
      id: 'duration',
      header: 'Duration',
      width: '130px',
      minWidth: '100px',
      cell: (m) => {
        const durationMinutes = m.meetingDurationMinutes || 30;
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={13} className="text-muted-foreground shrink-0" />
            <span>{formatDurationHuman(durationMinutes)}</span>
          </div>
        );
      },
    },
    {
      id: 'participants',
      header: 'Participants',
      width: '120px',
      minWidth: '100px',
      cell: (m) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users size={13} className="text-muted-foreground shrink-0" />
          <span>{m.participants?.length || 1}</span>
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right' as const,
      width: '180px',
      minWidth: '160px',
      cell: (m) => {
        const scheduledDate = new Date(m.meetingScheduledAt);
        const scheduledMs = scheduledDate.getTime();
        const durationMinutes = m.meetingDurationMinutes || 30;
        const earlyJoinMs = !isNaN(scheduledMs) ? scheduledMs - 5 * 60 * 1000 : 0;
        const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;
        const isPastDuration = !isNaN(scheduledMs) && now > endMs;
        const isTooEarly = !isNaN(scheduledMs) && now < earlyJoinMs;
        const isEndedOrCancelled =
          m.meetingStatus === 'ENDED' ||
          m.meetingStatus === 'CANCELLED' ||
          (m.meetingStatus !== 'LIVE' && isPastDuration);
        const canJoin = !isEndedOrCancelled && (!isTooEarly || m.meetingStatus === 'LIVE');

        let buttonText = 'Join';
        let buttonIcon: React.ReactNode = <Play size={12} fill="currentColor" className="shrink-0" />;

        if (isTooEarly) {
          buttonText = formatCountdown(scheduledMs, now);
          buttonIcon = <Clock size={12} className="shrink-0" />;
        }

        return (
          <div className="flex items-center justify-end gap-1.5">
            {!isEndedOrCancelled && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyLink(m.meetingJoinCode, m.meetingId)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Copy meeting link"
                >
                  {copiedMeetingId === m.meetingId ? (
                    <Check size={13} className="text-primary" />
                  ) : (
                    <Copy size={13} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(`/meetings/${m.meetingId}/summary`)}
                  className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                  title="View AI Meeting Summary"
                >
                  <Sparkles size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onShareLink(m.meetingJoinCode, m.meetingTitle)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Share meeting link"
                >
                  <Share2 size={13} />
                </Button>
              </>
            )}

            <Button
              size="sm"
              disabled={!canJoin}
              className="h-7 px-2.5 text-xs font-semibold gap-1"
              onClick={() => {
                const code = m.meetingJoinCode || (m as unknown as Record<string, string>)?.meeting_join_code;
                const id = m.meetingId || (m as unknown as Record<string, string>)?._id;
                if (code) {
                  onNavigate(`/meetings/join/${code}`);
                } else if (id) {
                  onNavigate(`/meetings/${id}/lobby`);
                }
              }}
            >
              {buttonIcon}
              <span>{buttonText}</span>
            </Button>
          </div>
        );
      },
    },
  ];
}
