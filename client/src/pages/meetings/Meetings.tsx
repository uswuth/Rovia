import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, Plus, LayoutGrid, Table2 } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTeams } from '@/hooks/useTeams';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable } from '@/components/ui/data-table';
import type { SearchableSelectOption } from '@/components/ui/searchable-select';
import { Pagination } from '@/components/ui/Pagination';
import { RosterDetailModal } from '@/components/members/RosterDetailModal';
import { useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings } from '@/api/meeting/meeting.api';
import { useDebounce } from '@/hooks/useDebounce';
import type { Meeting } from '@/api/meeting/meeting.types';
import type { Member } from '@/types/member.types';
import { CommonTabs, type TabItem } from '@/components/ui/common-tabs';
import { shareOrCopy } from '@/lib/share';

import { MeetingCardItem } from '@/components/meetings/list/MeetingCardItem';
import { getMeetingTableColumns } from '@/components/meetings/list/MeetingTableColumns';
import { MeetingFiltersBar } from '@/components/meetings/list/MeetingFiltersBar';

export const Meetings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { members: orgMembers } = useOrganization();
  const { projects, selectedProject } = useProject();
  const { teams } = useTeams();
  const { formatDateTimeStr } = useTimeFormat();

  const VIEW_MODE_TABS: TabItem[] = [
    { id: 'cards', label: 'List', icon: <LayoutGrid size={13} /> },
    { id: 'table', label: 'Table', icon: <Table2 size={13} /> },
  ];

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

  const { data: meetings, loading } = useQuery<Meeting[]>(
    queryKeys.meetings.list(filterProjectId),
    async () => {
      const res = await getMeetings({
        projectId: filterProjectId || undefined,
        limit: 100,
      });
      return res;
    },
    { enabled: isAuthenticated, list: true }
  );

  const projectFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: '', label: 'All Projects' },
      ...projects.map((p) => {
        const id = getProjectId(p);
        const name = getProjectName(p);
        const code = getProjectCode(p);
        return {
          value: id,
          label: code ? `${code} - ${name}` : name,
        };
      }),
    ];
  }, [projects]);

  const teamFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    const validTeams = (teams ?? []).filter((t) => {
      if (!filterProjectId) return true;
      const pObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
      const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (t.projectId as string);
      return parentPId === filterProjectId;
    });

    return [
      { value: '', label: 'All Teams' },
      ...validTeams.map((t) => ({
        value: (t.teamId || t._id) as string,
        label: (t.teamName || t.name) as string,
      })),
    ];
  }, [teams, filterProjectId]);

  const createdByFilterOptions = useMemo<SearchableSelectOption[]>(() => {
    const creatorMap = new Map<string, string>();

    (meetings ?? []).forEach((m) => {
      const creatorId = m.createdBy;
      if (creatorId && !creatorMap.has(creatorId)) {
        let name: string;
        if (user?.userId === creatorId) {
          name = `${user.userName || user.userEmail || 'You'} (You)`;
        } else {
          const matchedOrgMember = (orgMembers || []).find((om) => om.userId === creatorId);
          if (matchedOrgMember?.userName && !matchedOrgMember.userName.toLowerCase().startsWith('user')) {
            name = matchedOrgMember.userName;
          } else if (matchedOrgMember?.userEmail) {
            name = matchedOrgMember.userEmail.split('@')[0];
          } else {
            const participantObj = (m.participants || []).find((p) => {
              const po = p as unknown as Record<string, unknown>;
              return (po?.userId || po?._id || po?.id) === creatorId;
            }) as unknown as Record<string, unknown> | undefined;

            if (participantObj?.userName && typeof participantObj.userName === 'string' && !participantObj.userName.toLowerCase().startsWith('user')) {
              name = participantObj.userName;
            } else if (participantObj?.userEmail && typeof participantObj.userEmail === 'string') {
              name = participantObj.userEmail.split('@')[0];
            } else {
              name = `Creator (${creatorId.slice(-4)})`;
            }
          }
        }

        creatorMap.set(creatorId, name);
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

  const isHostOfSelectedTeam = Boolean(
    user?.userId &&
    filterTeamId &&
    teams.some((t) => {
      const match = (t.teamId || t._id) === filterTeamId;
      if (!match) return false;
      const teamLeadId = typeof t.teamLeadId === 'object' && t.teamLeadId !== null
        ? ((t.teamLeadId as Record<string, unknown>).userId || (t.teamLeadId as Record<string, unknown>)._id)
        : t.teamLeadId;
      return teamLeadId === user.userId;
    })
  );

  const canCreateMeeting =
    !isSelectedProjectReadOnly &&
    (isGlobalAdmin || (filterProjectId ? isHostOfSelectedProject : isHostOfAnyProject) || isHostOfSelectedTeam);

  const meetingColumns = useMemo(
    () =>
      getMeetingTableColumns({
        now,
        copiedMeetingId,
        formatDateTimeStr,
        onCopyLink: handleCopyLink,
        onShareLink: handleShareLink,
        onNavigate: navigate,
      }),
    [now, copiedMeetingId, formatDateTimeStr, navigate]
  );

  const statusTabs: TabItem[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past Meetings' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-5 pb-8 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Video size={20} className="text-primary shrink-0" />
            <span>{headerInfo.title}</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {headerInfo.description}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <CommonTabs
            items={VIEW_MODE_TABS}
            value={viewMode}
            onChange={(id) => setViewMode(id as 'cards' | 'table')}
          />

          {canCreateMeeting && (
            <Button
              size="sm"
              onClick={() => navigate(filterProjectId ? `/meetings/new?projectId=${filterProjectId}` : '/meetings/new')}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Plus size={14} />
              <span>Schedule</span>
            </Button>
          )}
        </div>
      </div>

      <MeetingFiltersBar
        currentTab={currentTab}
        onTabChange={(tabId) => {
          const newParams = new URLSearchParams(searchParams);
          newParams.set('tab', tabId);
          setSearchParams(newParams);
          setMeetingPage(1);
        }}
        statusTabs={statusTabs}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onClearSearch={() => setSearchInput('')}
        timeFilter={timeFilter}
        onTimeFilterChange={(val) => {
          const newParams = new URLSearchParams(searchParams);
          if (val && val !== 'all') {
            newParams.set('timeFilter', val);
          } else {
            newParams.delete('timeFilter');
          }
          setSearchParams(newParams);
          setMeetingPage(1);
        }}
        timeFilterOptions={timeFilterOptions}
        filterCreatedById={filterCreatedById}
        onCreatedByChange={(val) => {
          const newParams = new URLSearchParams(searchParams);
          if (val) {
            newParams.set('createdBy', val);
          } else {
            newParams.delete('createdBy');
          }
          setSearchParams(newParams);
          setMeetingPage(1);
        }}
        createdByFilterOptions={createdByFilterOptions}
        filterProjectId={filterProjectId}
        onProjectChange={(val) => {
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
        projectFilterOptions={projectFilterOptions}
        filterTeamId={filterTeamId}
        onTeamChange={(val) => {
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
        teamFilterOptions={teamFilterOptions}
        hasProjects={projects.length > 0}
        hasTeams={teams.length > 0}
      />

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
            {paginatedMeetings.map((m) => (
              <MeetingCardItem
                key={m.meetingId}
                meeting={m}
                projects={projects}
                teams={teams}
                orgMembers={orgMembers}
                now={now}
                formatDateTimeStr={formatDateTimeStr}
                copiedMeetingId={copiedMeetingId}
                onCopyLink={handleCopyLink}
                onShareLink={handleShareLink}
                isExpanded={Boolean(expandedMeetingIds[m.meetingId])}
                onToggleExpand={(mId) => {
                  setExpandedMeetingIds((prev) => ({
                    ...prev,
                    [mId]: !prev[mId],
                  }));
                }}
                onOpenRosterModal={setRosterModal}
              />
            ))}
          </div>

          {displayedMeetings.length > meetingPageSize && (
            <div className="pt-2 flex justify-end">
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
              />
            </div>
          )}
        </div>
      )}

      {rosterModal?.open && (
        <RosterDetailModal
          open={rosterModal.open}
          onClose={() => setRosterModal(null)}
          title={rosterModal.title}
          members={rosterModal.members}
          projectName={rosterModal.projectName}
          teamName={rosterModal.teamName}
        />
      )}
    </div>
  );
};

export default Meetings;
