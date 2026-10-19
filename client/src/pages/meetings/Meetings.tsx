import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Calendar, Clock, Users, Play, Plus, FolderGit2, Search, X, Copy, Check, Share2 } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { Pagination } from '@/components/ui/Pagination';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings } from '@/api/meeting/meeting.api';
import { useDebounce } from '@/hooks/useDebounce';
import type { Meeting, MeetingStatus } from '@/api/meeting/meeting.types';
import { formatCountdown } from '@/lib/format-countdown';
import { shareOrCopy } from '@/lib/share';
import { formatDuration } from '@/lib/format-date';
import { formatDurationHuman } from '@/utils/duration';

/** `IN_PROGRESS` is client-derived: inside the scheduled window before the server marks it LIVE. */
type MeetingDisplayStatus = MeetingStatus | 'IN_PROGRESS';

export const Meetings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { projects, selectedProject } = useProject();
  const { formatDateTimeStr } = useTimeFormat();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);

  const handleCopyLink = (joinCode: string, meetingId: string) => {
    const joinUrl = `${window.location.origin}/meetings/join/${joinCode}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedMeetingId(meetingId);
    setTimeout(() => setCopiedMeetingId(null), 2000);
  };

  const handleShareLink = async (joinCode: string, meetingTitle: string, meetingId?: string) => {
    const joinUrl = `${window.location.origin}/meetings/join/${joinCode}`;
    const res = await shareOrCopy({
      title: meetingTitle || 'IntellMeet Meeting',
      text: `Join meeting "${meetingTitle}" on IntellMeet`,
      url: joinUrl,
    });
    if ((res === 'copied' || res === 'shared') && meetingId) {
      setCopiedMeetingId(meetingId);
      setTimeout(() => setCopiedMeetingId(null), 2000);
    }
  };

  const currentTab = searchParams.get('tab') || 'upcoming';
  const filterProjectId = searchParams.get('projectId') || selectedProject?.id || '';

  const activeProject = projects.find((p) => getProjectId(p) === filterProjectId);
  const activeProjectName = activeProject ? getProjectName(activeProject) : (selectedProject ? getProjectName(selectedProject) : '');

  const projectFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: '', label: 'All Projects' },
      ...projects.map((p) => {
        const pId = getProjectId(p);
        const pName = getProjectName(p) || 'Unnamed Project';
        return {
          value: pId,
          label: pName,
        };
      }),
    ];
  }, [projects]);

  const { data: meetings, loading } = useQuery<Meeting[]>(
    queryKeys.meetings.list(filterProjectId || undefined),
    () => getMeetings(filterProjectId ? { projectId: filterProjectId } : undefined),
    { enabled: isAuthenticated, list: true }
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const sortedMeetings = useMemo(() => {
    const rawMeetings = meetings ?? [];
    return [...rawMeetings].sort((a, b) => {
      if (currentTab === 'upcoming') {
        const isLiveA = a.meetingStatus === 'LIVE';
        const isLiveB = b.meetingStatus === 'LIVE';
        if (isLiveA !== isLiveB) return isLiveA ? -1 : 1;

        const timeA = new Date(a.meetingScheduledAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.meetingScheduledAt || b.createdAt || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
      } else {
        const timeA = new Date(a.meetingScheduledAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.meetingScheduledAt || b.createdAt || 0).getTime();
        if (timeB !== timeA) return timeB - timeA;
      }
      return (b.meetingId || '').localeCompare(a.meetingId || '');
    });
  }, [meetings, currentTab]);

  const displayedMeetings = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return sortedMeetings.filter((m) => {
      if (q) {
        const titleMatch = (m.meetingTitle || '').toLowerCase().includes(q);
        const descMatch = (m.meetingDescription || '').toLowerCase().includes(q);
        const codeMatch = (m.meetingJoinCode || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !codeMatch) return false;
      }

      const scheduledMs = new Date(m.meetingScheduledAt).getTime();
      const durationMinutes = m.meetingDurationMinutes || 30;
      const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;
      const isPastDuration = !isNaN(scheduledMs) && now > endMs;
      const isEnded = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || (m.meetingStatus !== 'LIVE' && isPastDuration);

      if (currentTab === 'upcoming') {
        return !isEnded;
      }
      if (currentTab === 'past' || currentTab === 'ended') {
        return isEnded;
      }
      return true;
    });
  }, [sortedMeetings, debouncedSearch, currentTab, now]);

  const [meetingPage, setMeetingPage] = React.useState(1);
  const [meetingPageSize, setMeetingPageSize] = React.useState(5);

  const paginatedMeetings = displayedMeetings.slice(
    (meetingPage - 1) * meetingPageSize,
    meetingPage * meetingPageSize
  );
  const meetingTotalPages = Math.ceil(displayedMeetings.length / meetingPageSize) || 1;

  const getHeaderInfo = () => {
    if (currentTab === 'past' || currentTab === 'ended') {
      return {
        title: 'Meeting History',
        description: activeProjectName
          ? `Showing completed and past meetings for project '${activeProjectName}'.`
          : 'Showing history of all completed and concluded meetings in your organization.',
      };
    }
    if (currentTab === 'all') {
      return {
        title: 'All Sessions',
        description: activeProjectName
          ? `Showing all meetings (upcoming & past) under project '${activeProjectName}'.`
          : 'Showing all active, upcoming, and past meetings in your organization.',
      };
    }
    return {
      title: 'Upcoming Sessions',
      description: activeProjectName
        ? `Showing upcoming meetings scheduled under project '${activeProjectName}'.`
        : 'Showing all upcoming and scheduled meetings in your organization.',
    };
  };

  const headerInfo = getHeaderInfo();

  const activeProjectStatus = (activeProject?.projectStatus || activeProject?.status || '').toLowerCase();
  const isSelectedProjectReadOnly = activeProjectStatus === 'completed' || activeProjectStatus === 'archived';

  const isGlobalAdmin = Boolean(
    user?.isSuperAdmin || user?.userRole === 'SuperAdmin' || user?.userRole === 'Admin'
  );

  const isHostOfSelectedProject = Boolean(
    user?.userId &&
    activeProject &&
    (activeProject.hosts || []).some((h: unknown) => {
      if (typeof h === 'string') return h === user.userId;
      if (typeof h === 'object' && h !== null) {
        const obj = h as Record<string, unknown>;
        return (obj.userId || obj._id || obj.id) === user.userId;
      }
      return false;
    })
  );

  const isHostOfAnyProject = Boolean(
    user?.userId &&
    projects?.length &&
    projects.some((p) =>
      (p.hosts || []).some((h: unknown) => {
        if (typeof h === 'string') return h === user.userId;
        if (typeof h === 'object' && h !== null) {
          const obj = h as Record<string, unknown>;
          return (obj.userId || obj._id || obj.id) === user.userId;
        }
        return false;
      })
    )
  );

  const canCreateMeeting = isGlobalAdmin || (filterProjectId ? isHostOfSelectedProject : isHostOfAnyProject);

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Video size={24} className="text-primary" />
            <span>{headerInfo.title}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {headerInfo.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            disabled={isSelectedProjectReadOnly || !canCreateMeeting}
            onClick={() => !isSelectedProjectReadOnly && canCreateMeeting && navigate(filterProjectId ? `/meetings/new?projectId=${filterProjectId}` : '/meetings/new')}
            className="gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              !canCreateMeeting
                ? 'Only project/team hosts, Admins, or SuperAdmins can schedule meetings'
                : isSelectedProjectReadOnly
                ? `Selected project is ${activeProjectStatus}. Re-activate status to Active to schedule meetings.`
                : 'Schedule Meeting'
            }
          >
            <Plus size={15} />
            <span>Schedule Meeting</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setMeetingPage(1);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setMeetingPage(1);
                }
              }}
              placeholder="Search meetings by title or description..."
              className="pl-8 pr-8 h-9 text-xs"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setMeetingPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-xs"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setMeetingPage(1);
            }}
            className="h-9 px-3 gap-1.5 text-xs cursor-pointer shrink-0 border border-border"
          >
            <Search size={14} />
            <span>Search</span>
          </Button>
        </div>

        {projects.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto min-w-[220px]">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium shrink-0">
              <FolderGit2 size={13} />
              Project:
            </span>
            <div className="w-48">
              <SearchableSelect
                value={filterProjectId}
                onChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val) {
                    newParams.set('projectId', val);
                  } else {
                    newParams.delete('projectId');
                  }
                  setSearchParams(newParams);
                  setMeetingPage(1);
                }}
                options={projectFilterOptions}
                placeholder="All Projects"
                searchPlaceholder="Search projects..."
                className="w-full text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      ) : displayedMeetings.length === 0 ? (
        <EmptyState
          icon={Video}
          title={
            currentTab === 'upcoming'
              ? 'No upcoming meetings'
              : currentTab === 'past' || currentTab === 'ended'
              ? 'No past meetings found'
              : 'No meetings scheduled yet'
          }
          description={
            activeProjectName
              ? `There are no ${currentTab} meetings under project '${activeProjectName}'. Click below to schedule a meeting.`
              : `There are no ${currentTab} meetings in your workspace yet. Click below to schedule a meeting.`
          }
          actionLabel={canCreateMeeting ? 'Schedule Meeting' : undefined}
          onAction={canCreateMeeting ? () => navigate(filterProjectId ? `/meetings/new?projectId=${filterProjectId}` : '/meetings/new') : undefined}
          accentColor="emerald"
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {paginatedMeetings.map((m) => {
              const scheduledDate = new Date(m.meetingScheduledAt);
              const scheduledMs = scheduledDate.getTime();
              const dateStr = !isNaN(scheduledMs)
                ? formatDateTimeStr(scheduledDate)
                : m.meetingScheduledAt;
              const participantCount = m.participants?.length || 1;
              const durationMinutes = m.meetingDurationMinutes || 30;

              const earlyJoinMs = !isNaN(scheduledMs) ? scheduledMs - 5 * 60 * 1000 : 0;
              const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;

              const isPastDuration = !isNaN(scheduledMs) && now > endMs;
              const isTooEarly = !isNaN(scheduledMs) && now < earlyJoinMs;
              const isEndedOrCancelled = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || (m.meetingStatus !== 'LIVE' && isPastDuration);

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
              let buttonIcon: React.ReactNode = <Play size={14} fill="currentColor" className="shrink-0" />;

              if (isEndedOrCancelled) {
                buttonText = 'Meeting Ended';
                buttonIcon = null;
              } else if (isTooEarly) {
                buttonText = `Opens in ${formatCountdown(scheduledMs, now)}`;
                buttonIcon = <Clock size={14} className="shrink-0" />;
              }

              const projectMatch = projects.find((p) => getProjectId(p) === m.projectId);
              const pCode = projectMatch ? getProjectCode(projectMatch) : null;
              const pName = projectMatch ? getProjectName(projectMatch) : null;

              return (
                <div
                  key={m.meetingId}
                  className="rounded-md border border-border bg-card hover:border-emerald-500/30 p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={getMeetingStatusTone(statusLabel)}>{statusLabel}</Badge>
                      <Badge tone="neutral">{m.meetingJoinMode === 'INVITE_ONLY' ? 'Invite Only' : 'Open Link'}</Badge>
                      {(pCode || pName) && (
                        <Badge tone="neutral" className="gap-1 font-mono text-[10px]">
                          <FolderGit2 size={10} className="text-primary" />
                          <span>{pCode || pName}</span>
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-foreground">{m.meetingTitle}</h3>
                    {m.meetingDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{m.meetingDescription}</p>
                    )}

                    {(() => {
                      let actualDurationStr: string | null = null;
                      if (m.startedAt && m.endedAt) {
                        const startMs = new Date(m.startedAt).getTime();
                        const endMs = new Date(m.endedAt).getTime();
                        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
                          const elapsedMins = Math.round((endMs - startMs) / (60 * 1000));
                          actualDurationStr = formatDuration(elapsedMins);
                        }
                      }
                      return (
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-muted-foreground" />
                            {dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-muted-foreground" />
                            {actualDurationStr ? (
                              <span>{actualDurationStr} <span className="opacity-75">/ scheduled {formatDurationHuman(durationMinutes)}</span></span>
                            ) : (
                              <span>{formatDurationHuman(durationMinutes)}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={13} className="text-muted-foreground" />
                            {participantCount} Participant{participantCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {!isEndedOrCancelled && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyLink(m.meetingJoinCode, m.meetingId)}
                        className="gap-1 text-xs cursor-pointer border-border hover:bg-muted"
                        title="Copy meeting link to clipboard"
                      >
                        {copiedMeetingId === m.meetingId ? (
                          <>
                            <Check size={13} className="text-primary" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Link</span>
                          </>
                        )}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleShareLink(m.meetingJoinCode, m.meetingTitle)}
                        className="gap-1 text-xs cursor-pointer border-border hover:bg-muted"
                        title="Share meeting join link"
                      >
                        <Share2 size={13} />
                        <span>Share</span>
                      </Button>

                      <Button
                        disabled={!canJoin}
                        onClick={() => navigate(`/meetings/join/${m.meetingJoinCode}`)}
                        className="justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                      >
                        {buttonIcon}
                        <span className="truncate">{buttonText}</span>
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={meetingPage}
            totalPages={meetingTotalPages}
            totalItems={displayedMeetings.length}
            pageSize={meetingPageSize}
            pageSizeOptions={[5, 10, 25, 50]}
            onPageChange={setMeetingPage}
            onPageSizeChange={(newSize) => {
              setMeetingPageSize(newSize);
              setMeetingPage(1);
            }}
            className="rounded-md border"
          />
        </div>
      )}
    </div>
  );
};

export default Meetings;

