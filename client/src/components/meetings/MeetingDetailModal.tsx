import React from 'react';
import { Calendar, Clock, Users, Copy, Check, Share2, Play, Building2, FolderGit2 } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { getMeetingStatusTone } from '@/lib/status-tone';
import type { Meeting } from '@/api/meeting/meeting.types';
import type { Member } from '@/types/member.types';

export interface MeetingDetailModalProps {
  open: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  projectName?: string | null;
  projectCode?: string | null;
  teamName?: string | null;
  formattedDate?: string;
  durationText?: string;
  isEndedOrCancelled?: boolean;
  canJoin?: boolean;
  onJoin?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  copied?: boolean;
}

export const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({
  open,
  onClose,
  meeting,
  projectName,
  projectCode,
  teamName,
  formattedDate,
  durationText,
  isEndedOrCancelled = false,
  canJoin = false,
  onJoin,
  onCopy,
  onShare,
  copied = false,
}) => {
  if (!meeting) return null;

  const participantMembers: Member[] = (meeting.participants || []).map((p: unknown, idx: number) => {
    if (typeof p === 'object' && p !== null) {
      const pObj = p as Record<string, unknown>;
      return {
        userId: (pObj.userId || pObj._id || pObj.id || String(idx)) as string,
        userName: (pObj.userName || pObj.name || pObj.userEmail || `User ${idx + 1}`) as string,
        userEmail: (pObj.userEmail || pObj.email || '') as string,
        userRole: (pObj.userRole || 'Member') as Member['userRole'],
        userStatus: 'ACTIVE',
      };
    }
    return {
      userId: String(p || idx),
      userName: String(p || `User ${idx + 1}`),
      userEmail: '',
      userRole: 'Member',
      userStatus: 'ACTIVE',
    };
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meeting.meetingTitle}
      showCloseButton={true}
      className="max-w-lg space-y-4"
    >
      <div className="space-y-4">
        {/* Scope and Status Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {(projectCode || projectName) ? (
            <Badge tone="neutral" className="gap-1 font-mono text-xs">
              <FolderGit2 size={12} className="text-primary shrink-0" />
              <span>{projectCode || projectName}</span>
            </Badge>
          ) : teamName ? (
            <Badge tone="neutral" className="gap-1 text-xs">
              <Users size={12} className="text-primary shrink-0" />
              <span>{teamName}</span>
            </Badge>
          ) : (
            <Badge tone="neutral" className="gap-1 text-xs text-muted-foreground">
              <Building2 size={12} />
              <span>Org Meeting</span>
            </Badge>
          )}

          <Badge tone={getMeetingStatusTone(meeting.meetingStatus)}>{meeting.meetingStatus}</Badge>
        </div>

        {/* Full Description */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Description</span>
          <div className="rounded-sm bg-muted/40 p-3 max-h-48 overflow-y-auto text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap select-text">
            {meeting.meetingDescription || 'No description provided for this session.'}
          </div>
        </div>

        {/* Schedule & Duration Info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1 rounded-sm bg-muted/20 p-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Calendar size={13} className="text-primary" />
              Scheduled Time
            </span>
            <span className="font-semibold text-foreground block">{formattedDate || meeting.meetingScheduledAt}</span>
          </div>

          <div className="space-y-1 rounded-sm bg-muted/20 p-2.5">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock size={13} className="text-primary" />
              Duration
            </span>
            <span className="font-semibold text-foreground block">{durationText || `${meeting.meetingDurationMinutes || 30} mins`}</span>
          </div>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users size={13} className="text-primary" />
              Participants ({participantMembers.length})
            </span>
            <GroupedAvatars members={participantMembers} maxDisplay={4} size="xs" />
          </div>

          {participantMembers.length > 0 && (
            <div className="max-h-36 overflow-y-auto rounded-sm border border-border/50 divide-y divide-border/30 bg-muted/20 text-xs">
              {participantMembers.map((m) => (
                <div key={m.userId} className="p-2 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">{m.userName}</span>
                    {m.userEmail && <span className="text-[11px] text-muted-foreground truncate">({m.userEmail})</span>}
                  </div>
                  <Badge tone={(m.userRole as string).toUpperCase() === 'HOST' ? 'success' : 'neutral'} className="text-[10px] shrink-0">
                    {m.userRole}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Meeting Join Code & Action Bar */}
        <div className="pt-2 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>Code:</span>
            <span className="font-bold text-foreground bg-muted px-2 py-0.5 rounded-sm select-all">
              {meeting.meetingJoinCode}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isEndedOrCancelled && (
              <>
                {onCopy && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onCopy}
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                  >
                    {copied ? <Check size={13} className="text-primary" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </Button>
                )}
                {onShare && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onShare}
                    className="h-8 gap-1.5 text-xs cursor-pointer"
                  >
                    <Share2 size={13} />
                    <span>Share</span>
                  </Button>
                )}
                {onJoin && (
                  <Button
                    size="sm"
                    disabled={!canJoin}
                    onClick={onJoin}
                    className="h-8 px-3 text-xs gap-1.5 cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Join Room</span>
                  </Button>
                )}
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-xs cursor-pointer"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
