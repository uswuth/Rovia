import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Calendar, Clock, Users, Play, Plus, FolderGit2, Search, X, Copy, Check, Share2, LayoutGrid, Table2, Building2, Sparkles } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTeams } from '@/hooks/useTeams';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/data-table';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { Pagination } from '@/components/ui/Pagination';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { GroupedAvatars } from '@/components/members/GroupedAvatars';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getAvatarColorByName } from '@/components/ui/avatar-colors';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings } from '@/api/meeting/meeting.api';
import { useDebounce } from '@/hooks/useDebounce';
import type { Meeting, MeetingStatus } from '@/api/meeting/meeting.types';
import type { Member } from '@/types/member.types';
import { CommonTabs, type TabItem } from '@/components/ui/common-tabs';
import { formatDurationHuman } from '@/utils/duration';
import { formatCountdown } from '@/lib/format-countdown';
import { shareOrCopy } from '@/lib/share';

/** `IN_PROGRESS` is client-derived: inside the scheduled window before the server marks it LIVE. */
type MeetingDisplayStatus = MeetingStatus | 'IN_PROGRESS';

export const Meetings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { members: orgMembers } = useOrganization();
  const { projects, selectedProject } = useProject();
  const { teams } = useTeams();
  const VIEW_MODE_TABS: TabItem[] = [
    { id: 'cards', label: 'List', icon: <LayoutGrid size={13} /> },
    { id: 'table', label: 'Table', icon: <Table2 size={13} /> },
  ];
  const { formatDateTimeStr } = useTimeFormat();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  const [copiedMeetingId, setCopiedMeetingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Record<string, boolean>>({});
  const [rosterModal, setRosterModal] = useState<{
    open: boolean;
    title: string;
    members: Member[];
    projectName?: string;
    teamName?: string;
  } | null>(null);

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
  const filterTeamId = searchParams.get('teamId') || '';
  const filterCreatedById = searchParams.get('createdBy') || '';
  const timeFilter = searchParams.get('timeFilter') || 'all';

  const timeFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: 'all', label: 'All' },
      { value: 'live', label: 'Live Now' },
      { value: '1h', label: 'In 1 hour' },
      { value: '7h', label: 'In 7 hours' },
      { value: '24h', label: 'In 24 hours' },
    ];
  }, []);

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

  const teamFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    const filteredTeams = (teams ?? []).filter((t) => {
      if (!filterProjectId) return true;
      const pObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
      const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (t.projectId as string);
      return !parentPId || parentPId === filterProjectId;
    });

    return [
      { value: '', label: 'All Teams' },
      ...filteredTeams.map((t) => {
        const tmId = (t.teamId || t._id) as string;
        const tmName = (t.teamName as string) || (t.name as string) || 'Unnamed Team';
        return {
          value: tmId,
          label: tmName,
        };
      }),
    ];
  }, [teams, filterProjectId]);

  const { data: meetings, loading } = useQuery<Meeting[]>(
    queryKeys.meetings.list(filterProjectId || undefined),
    () => getMeetings(filterProjectId ? { projectId: filterProjectId } : undefined),
    { enabled: isAuthenticated, list: true }
  );

  const createdByFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    const creatorMap = new Map<string, string>();
    (meetings ?? []).forEach((m) => {
      if (m.createdBy) {
        const creatorId = m.createdBy;
        const orgMatch = (orgMembers || []).find((om) => om.userId === creatorId);
        const resolvedName = orgMatch?.userName || (user?.userId === creatorId ? user.userName : null) || 'Unknown Host';
        if (!creatorMap.has(creatorId)) {
          creatorMap.set(creatorId, resolvedName);
        }
      }
    });

    return [
      { value: '', label: 'All Creators' },
      ...Array.from(creatorMap.entries()).map(([id, name]) => ({
        value: id,
        label: name,
      })),
    ];
  }, [meetings, orgMembers, user]);

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

      if (filterTeamId && m.teamId !== filterTeamId) {
        return false;
      }

      if (filterCreatedById && m.createdBy !== filterCreatedById) {
        return false;
      }

      const scheduledMs = new Date(m.meetingScheduledAt).getTime();
      const durationMinutes = m.meetingDurationMinutes || 30;
      const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;
      const isPastDuration = !isNaN(scheduledMs) && now > endMs;
      const isEnded = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || (m.meetingStatus !== 'LIVE' && isPastDuration);

      if (currentTab === 'upcoming') {
        if (isEnded) return false;

        // Apply time-based filter for upcoming meetings
        if (timeFilter === 'live') {
          return m.meetingStatus === 'LIVE';
        }
        if (timeFilter === '1h') {
          const diffMs = scheduledMs - now;
          return m.meetingStatus === 'LIVE' || (diffMs >= 0 && diffMs <= 60 * 60 * 1000);
        }
        if (timeFilter === '7h') {
          const diffMs = scheduledMs - now;
          return m.meetingStatus === 'LIVE' || (diffMs >= 0 && diffMs <= 7 * 60 * 60 * 1000);
        }
        if (timeFilter === '24h') {
          const diffMs = scheduledMs - now;
          return m.meetingStatus === 'LIVE' || (diffMs >= 0 && diffMs <= 24 * 60 * 60 * 1000);
        }

        return true;
      }
      if (currentTab === 'past' || currentTab === 'ended') {
        return isEnded;
      }
      return true;
    });
  }, [sortedMeetings, debouncedSearch, currentTab, filterTeamId, filterCreatedById, timeFilter, now]);

  const [meetingPage, setMeetingPage] = useState(1);
  const [meetingPageSize, setMeetingPageSize] = useState(5);

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

  const meetingColumns: Column<Meeting>[] = useMemo(() => [
    {
      id: 'title',
      header: 'Meeting Session',
      minWidth: '220px',
      cell: (m) => {
        const projectMatch = projects.find((p) => getProjectId(p) === m.projectId);
        const pCode = projectMatch ? getProjectCode(projectMatch) : null;
        const pName = projectMatch ? getProjectName(projectMatch) : null;
        const teamMatch = m.teamId ? teams.find((t) => (t.teamId || t._id) === m.teamId) : null;
        const tName = teamMatch ? ((teamMatch.teamName || teamMatch.name) as string) : null;

        return (
          <div className="space-y-1">
            <div className="font-semibold text-foreground text-sm flex items-center gap-2">
              <span className="truncate">{m.meetingTitle}</span>
              {(pCode || pName) ? (
                <Badge tone="neutral" className="gap-1 font-mono text-[10px] shrink-0">
                  <FolderGit2 size={10} className="text-primary" />
                  <span>{pCode || pName}</span>
                </Badge>
              ) : tName ? (
                <Badge tone="neutral" className="gap-1 text-[10px] shrink-0">
                  <Users size={10} className="text-primary" />
                  <span>{tName}</span>
                </Badge>
              ) : (
                <Badge tone="neutral" className="gap-1 text-[10px] shrink-0 text-muted-foreground">
                  <Building2 size={10} />
                  <span>Org Meeting</span>
                </Badge>
              )}
            </div>
            {m.meetingDescription && (
              <p className={`text-xs text-muted-foreground leading-relaxed ${expandedMeetingIds[m.meetingId] ? '' : 'line-clamp-2'}`}>
                {m.meetingDescription}
                {m.meetingDescription.length > 80 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedMeetingIds((prev) => ({
                        ...prev,
                        [m.meetingId]: !prev[m.meetingId],
                      }));
                    }}
                    className="ml-1.5 text-primary hover:underline font-medium inline-flex items-center cursor-pointer"
                  >
                    {expandedMeetingIds[m.meetingId] ? 'less' : 'more...'}
                  </button>
                )}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      width: '130px',
      minWidth: '110px',
      cell: (m) => {
        const scheduledDate = new Date(m.meetingScheduledAt);
        const scheduledMs = scheduledDate.getTime();
        const durationMinutes = m.meetingDurationMinutes || 30;
        const earlyJoinMs = !isNaN(scheduledMs) ? scheduledMs - 5 * 60 * 1000 : 0;
        const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;
        const isPastDuration = !isNaN(scheduledMs) && now > endMs;
        const isEndedOrCancelled = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || (m.meetingStatus !== 'LIVE' && isPastDuration);

        let statusLabel: MeetingDisplayStatus = m.meetingStatus;
        if (m.meetingStatus === 'LIVE') {
          statusLabel = 'IN_PROGRESS';
        } else if (isEndedOrCancelled) {
          statusLabel = m.meetingStatus === 'CANCELLED' ? 'CANCELLED' : 'ENDED';
        } else if (now >= earlyJoinMs && now <= endMs) {
          statusLabel = 'IN_PROGRESS';
        } else if (!isNaN(scheduledMs) && now < earlyJoinMs) {
          statusLabel = 'SCHEDULED';
        }

        return <Badge tone={getMeetingStatusTone(statusLabel)}>{statusLabel}</Badge>;
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
        const isEndedOrCancelled = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || (m.meetingStatus !== 'LIVE' && isPastDuration);
        const canJoin = !isEndedOrCancelled && (!isTooEarly || m.meetingStatus === 'LIVE');

        return (
          <div className="flex items-center justify-end gap-1.5">
            {!isEndedOrCancelled && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyLink(m.meetingJoinCode, m.meetingId)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
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
                  onClick={() => navigate(`/meetings/${m.meetingId}/summary`)}
                  className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                  title="View AI Meeting Summary"
                >
                  <Sparkles size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleShareLink(m.meetingJoinCode, m.meetingTitle)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title="Share meeting link"
                >
                  <Share2 size={13} />
                </Button>
              </>
            )}

            {isEndedOrCancelled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/meetings/${m.meetingId}/summary`)}
                className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                title="View AI Meeting Summary"
              >
                <Sparkles size={13} />
              </Button>
            )}

            <Button
              size="sm"
              disabled={!canJoin}
              onClick={() => navigate(`/meetings/join/${m.meetingJoinCode}`)}
              className="h-7 px-2.5 text-xs gap-1 disabled:opacity-40"
            >
              {canJoin ? <Play size={11} fill="currentColor" /> : null}
              <span>{isEndedOrCancelled ? 'Ended' : isTooEarly ? 'Scheduled' : 'Join'}</span>
            </Button>
          </div>
        );
      },
    },
  ], [projects, teams, now, formatDateTimeStr, copiedMeetingId, navigate, expandedMeetingIds]);

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

        <div className="flex items-center gap-2.5 shrink-0">
          {/* View Mode Toggle: List vs Table */}
          <CommonTabs
            items={VIEW_MODE_TABS}
            value={viewMode}
            onChange={(val) => setViewMode(val as 'cards' | 'table')}
            size="sm"
          />

          <Button
            size="sm"
            disabled={isSelectedProjectReadOnly || !canCreateMeeting}
            onClick={() => !isSelectedProjectReadOnly && canCreateMeeting && navigate(filterProjectId ? `/meetings/new?projectId=${filterProjectId}` : '/meetings/new')}
            className="h-8 px-3 gap-1.5 rounded-xs text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              !canCreateMeeting
                ? 'Only project/team hosts, Admins, or SuperAdmins can schedule meetings'
                : isSelectedProjectReadOnly
                  ? `Selected project is ${activeProjectStatus}. Re-activate status to Active to schedule meetings.`
                  : 'Schedule Meeting'
            }
          >
            <Plus size={14} />
            <span>Schedule Meeting</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setMeetingPage(1);
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

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {currentTab === 'upcoming' && (
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto min-w-[170px]">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium shrink-0">
                <Clock size={13} className="text-primary" />
                Time:
              </span>
              <div className="w-36">
                <SearchableSelect
                  value={timeFilter}
                  onChange={(val) => {
                    const newParams = new URLSearchParams(searchParams);
                    if (val && val !== 'all') {
                      newParams.set('timeFilter', val);
                    } else {
                      newParams.delete('timeFilter');
                    }
                    setSearchParams(newParams);
                    setMeetingPage(1);
                  }}
                  options={timeFilterOptions}
                  placeholder="All"
                  searchPlaceholder="Filter time..."
                  className="w-full text-xs"
                />
              </div>
            </div>
          )}

          {createdByFilterOptions.length > 1 && (
            <div className="w-40 shrink-0">
              <SearchableSelect
                value={filterCreatedById}
                onChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val) {
                    newParams.set('createdBy', val);
                  } else {
                    newParams.delete('createdBy');
                  }
                  setSearchParams(newParams);
                  setMeetingPage(1);
                }}
                options={createdByFilterOptions}
                placeholder="All Creators"
                searchPlaceholder="Search creator..."
                className="w-full text-xs"
                align="right"
              />
            </div>
          )}

          {projects.length > 0 && (
            <div className="w-44 shrink-0">
              <SearchableSelect
                value={filterProjectId}
                onChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val) {
                    newParams.set('projectId', val);
                  } else {
                    newParams.delete('projectId');
                  }
                  if (filterTeamId) {
                    const matchedTeam = (teams ?? []).find((t) => ((t.teamId || t._id) as string) === filterTeamId);
                    if (matchedTeam) {
                      const pObj = typeof matchedTeam.projectId === 'object' && matchedTeam.projectId !== null ? (matchedTeam.projectId as Record<string, unknown>) : null;
                      const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (matchedTeam.projectId as string);
                      if (parentPId && val && parentPId !== val) {
                        newParams.delete('teamId');
                      }
                    }
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
          )}

          {teams.length > 0 && (
            <div className="w-40 shrink-0">
              <SearchableSelect
                value={filterTeamId}
                onChange={(val) => {
                  const newParams = new URLSearchParams(searchParams);
                  if (val) {
                    newParams.set('teamId', val);
                    const matchedTeam = (teams ?? []).find((t) => ((t.teamId || t._id) as string) === val);
                    if (matchedTeam) {
                      const pObj = typeof matchedTeam.projectId === 'object' && matchedTeam.projectId !== null ? (matchedTeam.projectId as Record<string, unknown>) : null;
                      const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (matchedTeam.projectId as string);
                      if (parentPId) {
                        newParams.set('projectId', parentPId);
                      }
                    }
                  } else {
                    newParams.delete('teamId');
                  }
                  setSearchParams(newParams);
                  setMeetingPage(1);
                }}
                options={teamFilterOptions}
                placeholder="All Teams"
                searchPlaceholder="Search teams..."
                className="w-full text-xs"
                align="right"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        viewMode === 'table' ? (
          <DataTable
            columns={meetingColumns}
            data={[]}
            loading={true}
            loadingRowCount={5}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-sm" />
            ))}
          </div>
        )
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
      ) : viewMode === 'table' ? (
        <div className="space-y-4">
          <DataTable
            columns={meetingColumns}
            data={paginatedMeetings}
            keyExtractor={(m) => m.meetingId}
            page={meetingPage}
            pageSize={meetingPageSize}
            pageSizeOptions={[5, 10, 25, 50]}
            totalCount={displayedMeetings.length}
            onPageChange={setMeetingPage}
            onPageSizeChange={(newSize) => {
              setMeetingPageSize(newSize);
              setMeetingPage(1);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4 w-full">
          <div className="space-y-3">
            {paginatedMeetings.map((m) => {
              const scheduledDate = new Date(m.meetingScheduledAt);
              const scheduledMs = scheduledDate.getTime();
              const dateStr = !isNaN(scheduledMs)
                ? formatDateTimeStr(scheduledDate)
                : m.meetingScheduledAt;
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

              // Participant members with accurate names resolved from orgMembers, project, or participant object
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

                // Match with registered workspace/organization member to get real actual name
                const matchedOrgMember = (orgMembers || []).find(
                  (om) => om.userId === id || (rawEmail && om.userEmail?.toLowerCase() === rawEmail.toLowerCase())
                );

                const finalName =
                  (matchedOrgMember?.userName && !matchedOrgMember.userName.toLowerCase().startsWith('user'))
                    ? matchedOrgMember.userName
                    : (rawName && !rawName.toLowerCase().startsWith('user'))
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

              // Resolve host member and creator info for the "created by" avatar
              const hostMember = participantMembers.find((p) => (p.userRole || '').toUpperCase() === 'HOST') || participantMembers[0];
              const hostName = hostMember?.userName || 'NaN';
              const creatorId = m.createdBy;
              const creatorMember = (orgMembers || []).find((om) => om.userId === creatorId) || hostMember;
              const creatorName = creatorMember?.userName || hostName;
              const creatorRole = creatorMember?.userRole || hostMember?.userRole || 'Host';
              const creatorInitial = creatorName.charAt(0).toUpperCase();
              const creatorColor = getAvatarColorByName(creatorName);
              const createdAtDate = m.createdAt ? new Date(m.createdAt) : scheduledDate;
              const createdAtStr = !isNaN(createdAtDate.getTime()) ? formatDateTimeStr(createdAtDate) : 'Recently';
              const isExpanded = Boolean(expandedMeetingIds[m.meetingId]);
              const descLength = m.meetingDescription?.trim().length || 0;
              const hasLongDescription = descLength > 120;

              return (
                <div
                  key={m.meetingId}
                  className="group rounded-sm border border-border bg-card hover:border-primary/40 p-4 transition-all space-y-3 shadow-xs"
                >
                  {/* Top Header Row: Title on left, Created By Avatar with tooltip + Status + Copy/Share on right */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors leading-snug truncate block">
                        {m.meetingTitle}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone={getMeetingStatusTone(statusLabel)} className="text-[10px]">{statusLabel}</Badge>

                      {!isEndedOrCancelled && (
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyLink(m.meetingJoinCode, m.meetingId)}
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
                            onClick={() => navigate(`/meetings/${m.meetingId}/summary`)}
                            className="h-6 w-6 p-0 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                            title="View AI Meeting Summary"
                          >
                            <Sparkles size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleShareLink(m.meetingJoinCode, m.meetingTitle)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Share"
                          >
                            <Share2 size={12} />
                          </Button>
                        </div>
                      )}

                      {isEndedOrCancelled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/meetings/${m.meetingId}/summary`)}
                          className="h-6 w-6 p-0 text-primary hover:text-primary hover:bg-primary/10 cursor-pointer"
                          title="View AI Meeting Summary"
                        >
                          <Sparkles size={12} />
                        </Button>
                      )}

                      <Tooltip className="w-auto">
                        <TooltipTrigger asChild>
                          <div
                            className={`size-6 rounded-full flex items-center justify-center font-bold text-[10px] ${creatorColor} shrink-0 shadow-xs cursor-pointer ring-1 ring-border/60 hover:ring-primary/60 transition-all ml-0.5`}
                          >
                            {creatorInitial}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end" className="p-2 space-y-1 text-left min-w-[150px] bg-popover text-popover-foreground border border-border shadow-md rounded-sm z-50">
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

                  {/* Description Row: Description on left (max-w-2xl) and Big Join Room button on right */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className={`w-full max-w-2xl ${isExpanded ? 'py-0.5' : 'h-8 min-h-[2rem] flex items-center'}`}>
                      {m.meetingDescription ? (
                        <p className={`text-xs text-muted-foreground leading-relaxed transition-all ${isExpanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                          {m.meetingDescription}
                          {hasLongDescription && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMeetingIds((prev) => ({
                                  ...prev,
                                  [m.meetingId]: !prev[m.meetingId],
                                }));
                              }}
                              className="ml-1.5 text-primary hover:underline font-semibold inline-flex items-center cursor-pointer"
                            >
                              {isExpanded ? 'less' : 'more...'}
                            </button>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">
                          No description
                        </p>
                      )}
                    </div>

                    {!isEndedOrCancelled && (
                      <div className="shrink-0 self-start sm:self-center">
                        <Button
                          size="default"
                          disabled={!canJoin}
                          onClick={() => navigate(`/meetings/join/${m.meetingJoinCode}`)}
                          className="h-8 px-4 text-xs font-semibold gap-1.5 cursor-pointer disabled:opacity-40 shadow-xs"
                        >
                          {buttonIcon}
                          <span>{buttonText}</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Project and Team pills + Schedule on left, Grouped Avatars on right */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/20">
                    <div className="flex flex-wrap items-center gap-2 min-w-0 text-xs text-muted-foreground">
                      {(pCode || pName) ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-muted/60 border border-border/80 text-foreground font-mono text-xs max-w-[150px] truncate">
                          <FolderGit2 size={11} className="text-primary shrink-0" />
                          <span className="truncate">{pCode || pName}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-muted/40 border border-border/60 text-muted-foreground text-xs">
                          <Building2 size={11} />
                          <span>Org Meeting</span>
                        </span>
                      )}

                      {tName && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-muted/60 border border-border/80 text-foreground text-xs max-w-[150px] truncate">
                          <Users size={11} className="text-primary shrink-0" />
                          <span className="truncate">{tName}</span>
                        </span>
                      )}

                      <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground pl-1">
                        <Calendar size={11} className="shrink-0" />
                        <span>{dateStr}</span>
                      </span>

                      <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock size={11} className="shrink-0" />
                        <span>{formatDurationHuman(durationMinutes)}</span>
                      </span>
                    </div>

                    <div className="shrink-0">
                      {participantMembers.length > 0 && (
                        <GroupedAvatars
                          members={participantMembers}
                          maxDisplay={4}
                          size="xs"
                          onClick={() => {
                            setRosterModal({
                              open: true,
                              title: `${m.meetingTitle} — Participants`,
                              members: participantMembers,
                              projectName: pName || undefined,
                              teamName: tName || undefined,
                            });
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={meetingPage}
            totalPages={meetingTotalPages}
            totalItems={displayedMeetings.length}
            pageSize={meetingPageSize}
            pageSizeOptions={[6, 12, 24, 48]}
            onPageChange={setMeetingPage}
            onPageSizeChange={(newSize) => {
              setMeetingPageSize(newSize);
              setMeetingPage(1);
            }}
            className="rounded-sm border"
          />
        </div>
      )}

      {rosterModal && (
        <RosterDetailModal
          open={rosterModal.open}
          onClose={() => setRosterModal(null)}
          title={rosterModal.title}
          projectName={rosterModal.projectName}
          teamName={rosterModal.teamName}
          members={rosterModal.members}
          canManage={false}
        />
      )}
    </div>
  );
};

export default Meetings;

