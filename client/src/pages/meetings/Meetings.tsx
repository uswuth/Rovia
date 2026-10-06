/* eslint-disable react-refresh/only-export-components */
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Calendar, Clock, Users, Play, Plus, FolderGit2, Search, X } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings } from '@/api/meeting/meeting.api';
import type { Meeting, MeetingStatus } from '@/api/meeting/meeting.types';

export const formatCountdown = (scheduledMs: number, now: number): string => {
  const totalMins = Math.max(1, Math.ceil((scheduledMs - now) / (60 * 1000)));

  const MINS_IN_YEAR = 525600; // 365 * 1440
  const MINS_IN_MONTH = 43200; // 30 * 1440
  const MINS_IN_DAY = 1440; // 24 * 60

  if (totalMins >= MINS_IN_YEAR) {
    const years = Math.floor(totalMins / MINS_IN_YEAR);
    const remMins = totalMins % MINS_IN_YEAR;
    const months = Math.floor(remMins / MINS_IN_MONTH);
    return months > 0 ? `${years}y ${months}m` : `${years}y`;
  }

  if (totalMins >= MINS_IN_MONTH) {
    const months = Math.floor(totalMins / MINS_IN_MONTH);
    const remMins = totalMins % MINS_IN_MONTH;
    const days = Math.floor(remMins / MINS_IN_DAY);
    return days > 0 ? `${months}m ${days}d` : `${months}m`;
  }

  if (totalMins >= MINS_IN_DAY) {
    const days = Math.floor(totalMins / MINS_IN_DAY);
    const remMins = totalMins % MINS_IN_DAY;
    const hours = Math.floor(remMins / 60);
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }

  if (totalMins >= 60) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  return `${totalMins}m`;
};

/**
 * `IN_PROGRESS` is a client-derived display state for a meeting inside its
 * scheduled window that the server has not yet marked LIVE.
 */
type MeetingDisplayStatus = MeetingStatus | 'IN_PROGRESS';

export const Meetings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { projects, selectedProject } = useProject();
  const { formatDateTimeStr } = useTimeFormat();

  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const currentTab = searchParams.get('tab') || 'upcoming';
  const filterProjectId = searchParams.get('projectId') || selectedProject?.id || '';

  const activeProject = projects.find((p) => getProjectId(p) === filterProjectId);
  const activeProjectName = activeProject ? getProjectName(activeProject) : (selectedProject ? getProjectName(selectedProject) : '');

  const { data: meetings, loading } = useQuery<Meeting[]>(
    queryKeys.meetings.list(filterProjectId || undefined),
    () => getMeetings(filterProjectId ? { projectId: filterProjectId } : undefined),
    { enabled: isAuthenticated, list: true }
  );

  // Join-window status depends on the current time
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Always sort meetings by last created first (newest creation date or ObjectId timestamp at top)
  const sortedMeetings = useMemo(() => {
    const rawMeetings = meetings ?? [];
    return [...rawMeetings].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.meetingScheduledAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.meetingScheduledAt || 0).getTime();
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (b.meetingId || '').localeCompare(a.meetingId || '');
    });
  }, [meetings]);

  // Filter meetings based on active search query and tab selection
  const displayedMeetings = useMemo(() => {
    const q = activeSearch.trim().toLowerCase();
    return sortedMeetings.filter((m) => {
      if (q) {
        const titleMatch = (m.meetingTitle || '').toLowerCase().includes(q);
        const descMatch = (m.meetingDescription || '').toLowerCase().includes(q);
        const codeMatch = (m.meetingJoinCode || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !codeMatch) return false;
      }

      const scheduledDate = new Date(m.meetingScheduledAt);
      const scheduledMs = scheduledDate.getTime();
      const durationMinutes = m.meetingDurationMinutes || 30;
      const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;

      const isEnded = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || (!isNaN(scheduledMs) && now > endMs);

      if (currentTab === 'upcoming') {
        return !isEnded;
      }
      if (currentTab === 'past' || currentTab === 'ended') {
        return isEnded;
      }
      return true;
    });
  }, [sortedMeetings, activeSearch, currentTab, now]);

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

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header Row: Heading & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Video size={24} className="text-emerald-500 dark:text-emerald-400" />
            <span>{headerInfo.title}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {headerInfo.description}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            disabled={isSelectedProjectReadOnly}
            onClick={() => !isSelectedProjectReadOnly && navigate(filterProjectId ? `/meetings/new?projectId=${filterProjectId}` : '/meetings/new')}
            className="gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isSelectedProjectReadOnly ? `Selected project is ${activeProjectStatus}. Re-activate status to Active to schedule meetings.` : 'Schedule Meeting'}
          >
            <Plus size={15} />
            <span>Schedule Meeting</span>
          </Button>
        </div>
      </div>

      {/* Search & Project Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        {/* Search Box with Search Button */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                if (!e.target.value) setActiveSearch('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setActiveSearch(searchInput);
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
                  setActiveSearch('');
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
              setActiveSearch(searchInput);
              setMeetingPage(1);
            }}
            className="h-9 px-3 gap-1.5 text-xs cursor-pointer shrink-0 border border-border"
          >
            <Search size={14} />
            <span>Search</span>
          </Button>
        </div>

        {/* Project Selector Filter */}
        {projects.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <FolderGit2 size={13} />
              Project:
            </span>
            <select
              value={filterProjectId}
              onChange={(e) => {
                const newParams = new URLSearchParams(searchParams);
                if (e.target.value) {
                  newParams.set('projectId', e.target.value);
                } else {
                  newParams.delete('projectId');
                }
                setSearchParams(newParams);
                setMeetingPage(1);
              }}
              className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">All Projects</option>
              {projects.map((p) => {
                const pId = getProjectId(p);
                const pName = getProjectName(p);
                return (
                  <option key={pId} value={pId}>
                    {pName}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      {/* Content Area */}
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
          actionLabel="Schedule Meeting"
          onAction={() => navigate(filterProjectId ? `/meetings/new?projectId=${filterProjectId}` : '/meetings/new')}
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
              const isEndedOrCancelled = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || isPastDuration;

              const canJoin = !isEndedOrCancelled && !isTooEarly;

              let statusLabel: MeetingDisplayStatus = m.meetingStatus;
              if (isPastDuration && m.meetingStatus !== 'CANCELLED') {
                statusLabel = 'ENDED';
              } else if (!isEndedOrCancelled && now >= earlyJoinMs) {
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
                          <FolderGit2 size={10} className="text-emerald-500" />
                          <span>{pCode || pName}</span>
                        </Badge>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-foreground">{m.meetingTitle}</h3>
                    {m.meetingDescription && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{m.meetingDescription}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar size={13} className="text-muted-foreground" />
                        {dateStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={13} className="text-muted-foreground" />
                        {durationMinutes} mins
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={13} className="text-muted-foreground" />
                        {participantCount} Participant{participantCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <Button
                    disabled={!canJoin}
                    onClick={() => navigate(`/meetings/join/${m.meetingJoinCode}`)}
                    className="w-full sm:w-40 shrink-0 justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                  >
                    {buttonIcon}
                    <span className="truncate">{buttonText}</span>
                  </Button>
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

