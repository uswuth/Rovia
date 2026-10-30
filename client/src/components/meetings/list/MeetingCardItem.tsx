import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  Play,
  Copy,
  Check,
  Share2,
  Building2,
  FolderGit2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { formatDurationHuman } from '@/utils/duration';
import { formatCountdown } from '@/lib/format-countdown';
import { getProjectId, getProjectName, getProjectCode, type Project } from '@/types/project.types';
import type { Meeting, MeetingStatus } from '@/api/meeting/meeting.types';
import type { Member } from '@/types/member.types';

export type TeamItem = Record<string, unknown> & {
  teamId?: string;
  _id?: string;
  teamName?: string;
  name?: string;
  projectId?: unknown;
  teamLeadId?: unknown;
};

export type MeetingDisplayStatus = MeetingStatus | 'IN_PROGRESS';

export interface MeetingCardItemProps {
  meeting: Meeting;
  projects: Project[];
  teams: TeamItem[];
  orgMembers: Member[];
  now: number;
  formatDateTimeStr: (date: Date) => string;
  copiedMeetingId: string | null;
  onCopyLink: (joinCode: string, meetingId: string) => void;
  onShareLink: (joinCode: string, title: string, meetingId?: string) => void;
  isExpanded: boolean;
  onToggleExpand: (meetingId: string) => void;
  onOpenRosterModal: (data: {
    open: boolean;
    title: string;
    members: Member[];
    projectName?: string;
    teamName?: string;
  }) => void;
}

export const MeetingCardItem: React.FC<MeetingCardItemProps> = ({
  meeting: m,
  projects,
  teams,
  orgMembers,
  now,
  formatDateTimeStr,
  copiedMeetingId,
  onCopyLink,
  onShareLink,
  isExpanded,
  onToggleExpand,
  onOpenRosterModal,
}) => {
  const navigate = useNavigate();

  const scheduledDate = new Date(m.meetingScheduledAt);
  const scheduledMs = scheduledDate.getTime();
  const dateStr = !isNaN(scheduledMs) ? formatDateTimeStr(scheduledDate) : m.meetingScheduledAt;
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

  let buttonText = 'Join Room';
  let buttonIcon: React.ReactNode = <Play size={13} fill="currentColor" className="shrink-0" />;

  if (isTooEarly) {
    buttonText = `Opens in ${formatCountdown(scheduledMs, now)}`;
    buttonIcon = <Clock size={13} className="shrink-0" />;
  }

  const projectMatch = projects.find((p) => getProjectId(p) === m.projectId);
  const pCode = projectMatch ? getProjectCode(projectMatch) : null;
  const pName = projectMatch ? getProjectName(projectMatch) : null;
  const teamMatch = m.teamId ? teams.find((t) => (t.teamId || t._id) === m.teamId) : null;
  const tName = teamMatch ? ((teamMatch.teamName || teamMatch.name) as string) : null;

  const participantMembers: Member[] = (m.participants || []).map((p: unknown, idx: number) => {
    let id = String(idx);
    let role = 'Member';
    let rawName = '';
    let rawEmail = '';
    let rawAvatar = '';

    if (typeof p === 'object' && p !== null) {
      const pObj = p as Record<string, unknown>;
      id = String(pObj.userId || pObj._id || pObj.id || idx);
      role = String(pObj.participantRole || pObj.userRole || 'Member');
      rawName = String(pObj.userName || pObj.name || '');
      rawEmail = String(pObj.userEmail || pObj.email || '');
      rawAvatar = String(pObj.avatarUrl || pObj.avatar || '');
    } else if (typeof p === 'string') {
      id = p;
    }

    const matchedOrgMember = (orgMembers || []).find(
      (om) => om.userId === id || (rawEmail && om.userEmail?.toLowerCase() === rawEmail.toLowerCase())
    );

    const finalName =
      matchedOrgMember?.userName && !matchedOrgMember.userName.toLowerCase().startsWith('user')
        ? matchedOrgMember.userName
        : rawName && !rawName.toLowerCase().startsWith('user')
        ? rawName
        : matchedOrgMember?.userEmail
        ? matchedOrgMember.userEmail.split('@')[0]
        : rawEmail
        ? rawEmail.split('@')[0]
        : `Participant ${idx + 1}`;

    const finalEmail = matchedOrgMember?.userEmail || rawEmail;
    const finalAvatar = matchedOrgMember?.avatarUrl || rawAvatar;

    return {
      userId: id,
      userName: finalName,
      userEmail: finalEmail,
      userRole: (matchedOrgMember?.userRole || role) as Member['userRole'],
      userStatus: 'ACTIVE',
      avatarUrl: finalAvatar || undefined,
    };
  });

  const hostMember =
    participantMembers.find((p) => (p.userRole || '').toUpperCase() === 'HOST') || participantMembers[0];
  const hostName = hostMember?.userName || 'NaN';
  const creatorId = m.createdBy;
  const creatorMember = (orgMembers || []).find((om) => om.userId === creatorId) || hostMember;
  const creatorName = creatorMember?.userName || hostName;
  const creatorRole = creatorMember?.userRole || hostMember?.userRole || 'Host';
  const creatorInitial = creatorName.charAt(0).toUpperCase();
  const creatorColor = getAvatarColorByName(creatorName);
  const createdAtDate = m.createdAt ? new Date(m.createdAt) : scheduledDate;
  const createdAtStr = !isNaN(createdAtDate.getTime()) ? formatDateTimeStr(createdAtDate) : 'Recently';
  const descLength = m.meetingDescription?.trim().length || 0;
  const hasLongDescription = descLength > 120;

  return (
    <div
      key={m.meetingId}
      className="group rounded-sm border border-border bg-card hover:border-primary/40 p-4 transition-all space-y-3 shadow-xs"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-snug truncate block">
            {m.meetingTitle}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge tone={getMeetingStatusTone(statusLabel)} className="text-[10px]">
            {statusLabel}
          </Badge>

          {!isEndedOrCancelled && (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopyLink(m.meetingJoinCode, m.meetingId)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Copy link"
              >
                {copiedMeetingId === m.meetingId ? (
                  <Check size={12} className="text-primary" />
                ) : (
                  <Copy size={12} />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onShareLink(m.meetingJoinCode, m.meetingTitle, m.meetingId)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Share link"
              >
                <Share2 size={12} />
              </Button>
            </div>
          )}

          <Tooltip className="w-auto">
            <TooltipTrigger asChild>
              <div className="size-6 shrink-0 rounded-full flex items-center justify-center font-bold text-[10px] text-white border border-border/60 shadow-xs cursor-pointer select-none">
                {creatorMember?.avatarUrl ? (
                  <img
                    src={creatorMember.avatarUrl}
                    alt={creatorName}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="size-full rounded-full flex items-center justify-center"
                    style={{ backgroundColor: creatorColor }}
                  >
                    {creatorInitial}
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="end"
              className="p-2 space-y-1 text-left min-w-[150px] bg-popover text-popover-foreground border border-border shadow-md rounded-sm z-50"
            >
              <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                <span>{creatorName}</span>
                <span className="text-[10px] font-normal px-1 py-0.2 rounded-xs bg-primary/15 text-primary border border-primary/20">
                  {creatorRole}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Created at: <span className="text-foreground">{createdAtStr}</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {m.meetingDescription && (
        <div className="text-xs text-muted-foreground leading-relaxed">
          <p className={!isExpanded && hasLongDescription ? 'line-clamp-2' : ''}>
            {m.meetingDescription}
          </p>
          {hasLongDescription && (
            <button
              type="button"
              onClick={() => onToggleExpand(m.meetingId)}
              className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary hover:underline mt-1 cursor-pointer"
            >
              <span>{isExpanded ? 'Show less' : 'Read more'}</span>
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      )}

      {(pName || tName) && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {pName && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 text-[11px] font-medium text-secondary-foreground border border-border/50 max-w-full">
              <FolderGit2 size={11} className="text-primary shrink-0" />
              <span className="font-semibold truncate">
                {pCode ? `${pCode} · ${pName}` : pName}
              </span>
            </div>
          )}
          {tName && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/80 text-[11px] font-medium text-secondary-foreground border border-border/50 max-w-full">
              <Building2 size={11} className="text-muted-foreground shrink-0" />
              <span className="truncate">{tName}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-muted-foreground shrink-0" />
          <span className="truncate">{dateStr}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-muted-foreground shrink-0" />
          <span>{formatDurationHuman(durationMinutes)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users size={13} className="text-muted-foreground shrink-0" />
          <span>{participantMembers.length || 1}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <GroupedAvatars
            members={participantMembers}
            maxDisplay={4}
            size="sm"
            onClick={() =>
              onOpenRosterModal({
                open: true,
                title: m.meetingTitle,
                members: participantMembers,
                projectName: pName || undefined,
                teamName: tName || undefined,
              })
            }
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
            onClick={() => navigate(`/meetings/${m.meetingId}/summary`)}
            title="View AI Meeting Summary"
          >
            <Sparkles size={13} />
            <span className="hidden sm:inline">AI Summary</span>
          </Button>

          <Button
            size="sm"
            className="h-8 text-xs font-semibold gap-1.5"
            disabled={!canJoin}
            onClick={() => {
              const code = m.meetingJoinCode || (m as unknown as Record<string, string>)?.meeting_join_code;
              const meetingId = m.meetingId || (m as unknown as Record<string, string>)?._id;
              if (code) {
                navigate(`/meetings/join/${code}`);
              } else if (meetingId) {
                navigate(`/meetings/${meetingId}/lobby`);
              }
            }}
          >
            {buttonIcon}
            <span>{buttonText}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
