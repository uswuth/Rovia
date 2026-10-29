import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowLeft,
  Calendar,
  Clock,
  Building2,
  FolderGit2,
  FileDown,
  Loader2,
  Hash,
  Share2,
  Check,
  Users,
  ExternalLink,
  Video,
  Search,
  X,
  ListFilter,
  ChevronRight,
} from 'lucide-react';
import { getMeetings, getMeetingById, summarizeMeeting } from '@/api/meeting/meeting.api';
import { getRecordings, getRecordingSummary, getRecordingTranscript } from '@/api/recording/recording.api';
import type { MeetingSummary, Transcript, RecordingWithAiStatus } from '@/api/recording/recording.types';
import type { Meeting, MeetingParticipant } from '@/api/meeting/meeting.types';
import type { Member } from '@/types/member.types';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useProject } from '@/context/ProjectContext';
import { useTeams } from '@/hooks/useTeams';
import { useTimeFormat } from '@/context/TimeFormatContext';
import { Button } from '@/components/ui/button';
import { jsPDF } from 'jspdf';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { formatDurationHuman } from '@/utils/duration';
import { MemberRoster } from '@/components/members/MemberRoster';
import { MeetingAiSummaryCard } from '@/components/meetings/MeetingAiSummaryCard';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecorderStage } from '@/hooks/useMeetingRecorder';
import { extractApiItems } from '@/utils/apiResponse';
import { useDebounce } from '@/hooks/useDebounce';

interface SummaryRecordItem {
  meetingId: string;
  recordingId?: string;
  meetingTitle: string;
  meetingJoinCode?: string;
  meetingStatus?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  projectId?: string | null;
  teamId?: string | null;
  summaryStatus?: string;
  hasSummary: boolean;
  hasTranscript: boolean;
}

export const MeetingAiSummaryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { org, members: orgMembers } = useOrganization();
  const { projects } = useProject();
  const { teams } = useTeams();
  const { formatDateTimeStr } = useTimeFormat();

  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Search & Filter state for the All Summaries Hub
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterTeam, setFilterTeam] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  // 1. Fetch meetings list
  const { data: allMeetingsRaw, isLoading: isMeetingsLoading } = useQuery({
    queryKey: ['meetings', 'all-for-summary-page', filterProject],
    queryFn: async () => {
      const res = await getMeetings({
        projectId: filterProject && filterProject !== 'NONE' ? filterProject : undefined,
      });
      return res;
    },
  });

  const allMeetings = useMemo<Meeting[]>(() => {
    return extractApiItems<Meeting>(allMeetingsRaw);
  }, [allMeetingsRaw]);

  // 2. Fetch recordings list
  const { data: allRecordingsRaw, isLoading: isRecordingsListLoading } = useQuery({
    queryKey: ['recordings', 'all-for-summary-page', filterProject],
    queryFn: async () => {
      const res = await getRecordings({
        projectId: filterProject && filterProject !== 'NONE' ? filterProject : undefined,
        limit: 100,
      });
      return res;
    },
  });

  const allRecordings = useMemo<RecordingWithAiStatus[]>(() => {
    return extractApiItems<RecordingWithAiStatus>(allRecordingsRaw);
  }, [allRecordingsRaw]);

  // Target meeting ID when viewing a specific meeting
  const targetMeetingId = id;

  // Single Meeting Detail Query (only when `id` is present)
  const {
    data: meetingData,
    isLoading: isMeetingLoading,
    error: meetingError,
  } = useQuery({
    queryKey: ['meeting', targetMeetingId],
    queryFn: async () => {
      if (!targetMeetingId) throw new Error('Missing meeting ID');
      const res = await getMeetingById(targetMeetingId);
      return res.data.data;
    },
    enabled: Boolean(targetMeetingId),
  });

  const meeting: Meeting | undefined = meetingData;

  // Recordings for specific target meeting
  const {
    data: targetRecordings = [],
    isLoading: isTargetRecordingsLoading,
  } = useQuery({
    queryKey: ['recordings', 'meeting', targetMeetingId],
    queryFn: async () => {
      if (!targetMeetingId) return [];
      const res = await getRecordings({ meetingId: targetMeetingId });
      return res.items || [];
    },
    enabled: Boolean(targetMeetingId),
  });

  const activeRecording: RecordingWithAiStatus | undefined = useMemo(() => {
    if (!targetRecordings || targetRecordings.length === 0) return undefined;
    const ready = targetRecordings.find((r) => r.summaryStatus === 'READY');
    return ready || targetRecordings[0];
  }, [targetRecordings]);

  // Specific meeting Transcript
  const {
    data: transcriptData,
    isLoading: isTranscriptLoading,
  } = useQuery<Transcript | null>({
    queryKey: ['recording-transcript', activeRecording?.recordingId],
    queryFn: async () => {
      if (!activeRecording?.recordingId) return null;
      return await getRecordingTranscript(activeRecording.recordingId);
    },
    enabled: Boolean(targetMeetingId && activeRecording?.recordingId),
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.transcriptStatus;
      if (status === 'READY' || status === 'FAILED') return false;
      return 5_000;
    },
  });

  // Specific meeting Summary: only queried when the recording explicitly has a ready or processing summary status
  const shouldQuerySummary = Boolean(
    targetMeetingId &&
    activeRecording?.recordingId &&
    (activeRecording.summaryStatus === 'READY' || activeRecording.summaryStatus === 'PROCESSING')
  );

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery<MeetingSummary | null>({
    queryKey: ['recording-summary', activeRecording?.recordingId],
    queryFn: async () => {
      if (!activeRecording?.recordingId) return null;
      try {
        return await getRecordingSummary(activeRecording.recordingId);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) return null;
        throw err;
      }
    },
    enabled: shouldQuerySummary,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.summaryStatus;
      if (status === 'READY' || status === 'FAILED') return false;
      return 5_000;
    },
  });

  // Compile unified summary items for the All Summaries Hub
  const summaryHubItems = useMemo<SummaryRecordItem[]>(() => {
    const recordingsByMeetingId = new Map<string, RecordingWithAiStatus[]>();
    for (const rec of allRecordings) {
      if (rec.meetingId) {
        const list = recordingsByMeetingId.get(rec.meetingId) || [];
        list.push(rec);
        recordingsByMeetingId.set(rec.meetingId, list);
      }
    }

    const items: SummaryRecordItem[] = [];

    for (const m of allMeetings) {
      const recs = recordingsByMeetingId.get(m.meetingId) || [];
      const readyRec = recs.find((r) => r.summaryStatus === 'READY');
      const anyRec = readyRec || recs[0];

      const hasSummary = Boolean(readyRec || m.meetingStatus === 'ENDED');
      const hasTranscript = Boolean(anyRec?.transcriptionStatus === 'READY');

      items.push({
        meetingId: m.meetingId,
        recordingId: anyRec?.recordingId,
        meetingTitle: m.meetingTitle,
        meetingJoinCode: m.meetingJoinCode,
        meetingStatus: m.meetingStatus,
        scheduledAt: m.meetingScheduledAt || m.createdAt,
        durationMinutes: m.meetingDurationMinutes || 30,
        projectId: m.projectId,
        teamId: m.teamId,
        summaryStatus: anyRec?.summaryStatus || (m.meetingStatus === 'ENDED' ? 'AVAILABLE' : undefined),
        hasSummary,
        hasTranscript,
      });
    }

    // Sort: most recently scheduled/created first
    return items.sort((a, b) => {
      const timeA = new Date(a.scheduledAt || 0).getTime();
      const timeB = new Date(b.scheduledAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allMeetings, allRecordings]);

  // Filtered hub items based on search and filters
  const filteredHubItems = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return summaryHubItems.filter((item) => {
      if (q) {
        const matchesTitle = item.meetingTitle.toLowerCase().includes(q);
        const matchesCode = (item.meetingJoinCode || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode) return false;
      }
      if (filterProject) {
        if (filterProject === 'NONE') {
          if (item.projectId) return false;
        } else if (item.projectId !== filterProject) {
          return false;
        }
      }
      if (filterTeam) {
        if (filterTeam === 'NONE') {
          if (item.teamId) return false;
        } else if (item.teamId !== filterTeam) {
          return false;
        }
      }
      if (statusFilter === 'ready' && !item.hasSummary) {
        return false;
      }
      return true;
    });
  }, [summaryHubItems, debouncedSearch, filterProject, filterTeam, statusFilter]);

  // Paginate the filtered hub items
  const paginatedHubItems = useMemo(() => {
    return filteredHubItems.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredHubItems, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredHubItems.length / pageSize));

  // Project options for filter
  const projectOptions = useMemo<SearchableSelectOption[]>(() => {
    return [
      { value: '', label: 'All Projects' },
      { value: 'NONE', label: 'No Specific Project' },
      ...projects.map((p) => ({
        value: getProjectId(p),
        label: getProjectName(p) || 'Unnamed Project',
      })),
    ];
  }, [projects]);

  // Team options for filter
  const teamOptions = useMemo<SearchableSelectOption[]>(() => {
    const filtered = (teams ?? []).filter((t) => {
      if (!filterProject || filterProject === 'NONE') return true;
      const pObj = typeof t.projectId === 'object' && t.projectId !== null ? (t.projectId as Record<string, unknown>) : null;
      const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (t.projectId as string);
      return !parentPId || parentPId === filterProject;
    });

    return [
      { value: '', label: 'All Teams' },
      { value: 'NONE', label: 'No Specific Team' },
      ...filtered.map((t) => ({
        value: (t.teamId || t._id) as string,
        label: (t.teamName as string) || (t.name as string) || 'Unnamed Team',
      })),
    ];
  }, [teams, filterProject]);

  // Detail View Helpers
  const meetingProjectId = meeting?.projectId;
  const projectMatch = useMemo(() => {
    if (!meetingProjectId) return null;
    return projects.find((p) => getProjectId(p) === meetingProjectId) || null;
  }, [projects, meetingProjectId]);

  const pCode = projectMatch ? getProjectCode(projectMatch) : null;
  const pName = projectMatch ? getProjectName(projectMatch) : null;

  const meetingTeamId = meeting?.teamId;
  const teamMatch = useMemo(() => {
    if (!meetingTeamId) return null;
    return teams.find((t) => (t.teamId || t._id) === meetingTeamId) || null;
  }, [teams, meetingTeamId]);

  const tName = teamMatch ? ((teamMatch.teamName || teamMatch.name) as string) : null;

  const participantMembers: Member[] = useMemo(() => {
    if (!meeting?.participants) return [];
    return (meeting.participants as Array<MeetingParticipant | Record<string, unknown> | string>).map(
      (p, idx) => {
        let memberId = String(idx);
        let role = 'Member';
        let rawName = '';
        let rawEmail = '';
        let rawAvatar = '';

        if (typeof p === 'object' && p !== null) {
          const pObj = p as Record<string, unknown>;
          memberId = String(pObj.userId || pObj._id || pObj.id || idx);
          role = String(pObj.participantRole || pObj.userRole || 'Member');
          rawName = String(pObj.userName || pObj.name || '');
          rawEmail = String(pObj.userEmail || pObj.email || '');
          rawAvatar = String(pObj.avatarUrl || pObj.avatar || '');
        } else if (typeof p === 'string') {
          memberId = p;
        }

        const matchedOrgMember = (orgMembers || []).find(
          (om) => om.userId === memberId || (rawEmail && om.userEmail?.toLowerCase() === rawEmail.toLowerCase())
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

        const finalEmail = matchedOrgMember?.userEmail || rawEmail || 'No email registered';
        const finalAvatar = matchedOrgMember?.avatarUrl || rawAvatar;

        return {
          userId: memberId,
          userName: finalName,
          userEmail: finalEmail,
          userRole: (matchedOrgMember?.userRole || role) as Member['userRole'],
          userStatus: 'ACTIVE',
          avatarUrl: finalAvatar || undefined,
        };
      }
    );
  }, [meeting?.participants, orgMembers]);

  const rosterRoleValues = useMemo<Record<string, 'Host' | 'Member'>>(() => {
    const map: Record<string, 'Host' | 'Member'> = {};
    participantMembers.forEach((m) => {
      map[m.userId] = (m.userRole || '').toUpperCase() === 'HOST' ? 'Host' : 'Member';
    });
    return map;
  }, [participantMembers]);

  const scheduledDate = meeting?.meetingScheduledAt ? new Date(meeting.meetingScheduledAt) : null;
  const scheduledDateStr = scheduledDate ? formatDateTimeStr(scheduledDate) : 'N/A';
  const orgName = org?.name || 'IntellMeet Platform';
  const exporterName = user?.userName || 'User';
  const exporterEmail = user?.userEmail || '';
  const exportDateStr = formatDateTimeStr(new Date());
  const exporterRole = user?.userRole || 'Member';

  const handlePrint = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 48;
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(240, 240, 240);
    doc.rect(0, 0, pageWidth, 60, 'F');
    let y = 28;
    const contentWidth = pageWidth - margin * 2;

    const writeLine = (text: string, size = 11, bold = false, color: [number, number, number] = [30, 30, 30]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, contentWidth);
      for (const ln of lines) {
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(ln, margin, y);
        y += size + 4;
      }
    };

    writeLine(orgName, 16, true, [20, 20, 20]);
    writeLine('IntellMeet AI Executive Meeting Summary', 11, false, [90, 90, 90]);
    y += 6;
    writeLine(`Exported by: ${exporterName}  (${exporterRole})`, 10, false, [90, 90, 90]);
    if (exporterEmail) writeLine(exporterEmail, 10, false, [90, 90, 90]);
    writeLine(`Exported: ${exportDateStr}`, 10, false, [90, 90, 90]);
    y += 10;

    writeLine('Meeting Details', 13, true);
    writeLine(`Title: ${meeting?.meetingTitle ?? '—'}`, 11);
    writeLine(`Meeting ID: ${meeting?.meetingId ?? '—'}`, 10);
    writeLine(`Join Code: ${meeting?.meetingJoinCode ?? '—'}`, 10);
    writeLine(`Scheduled: ${scheduledDateStr}`, 10);
    y += 10;

    writeLine('AI Meeting Executive Summary', 13, true);
    if (summaryData?.summaryText) writeLine(summaryData.summaryText, 11);
    y += 6;
    const keyPoints = (summaryData?.summaryKeyPoints ?? []) as string[];
    if (keyPoints.length) {
      writeLine('Key Points', 12, true);
      for (const kp of keyPoints) writeLine(`• ${kp}`, 11);
      y += 6;
    }

    const transcriptText = transcriptData?.transcriptText;
    if (transcriptText) {
      writeLine('Transcript', 13, true);
      writeLine(transcriptText, 10);
    }

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleGenerateSummary = async () => {
    if (!targetMeetingId) return;
    setIsGeneratingSummary(true);
    setGenerateError(null);
    try {
      await summarizeMeeting(targetMeetingId);
      await refetchSummary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate AI summary';
      setGenerateError(msg);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const isLoadingOverall = isMeetingLoading || isTargetRecordingsLoading;
  const hasNoAiOutput =
    Boolean(activeRecording) &&
    !isSummaryLoading &&
    !isTranscriptLoading &&
    !summaryData &&
    !transcriptData;

  const summaryStage: RecorderStage = useMemo(() => {
    if (activeRecording?.summaryStatus === 'READY' || summaryData?.summaryStatus === 'READY') return 'ready';
    if (transcriptData?.transcriptStatus === 'READY' || transcriptData?.transcriptText) return 'ready';
    if (activeRecording?.summaryStatus === 'FAILED' || summaryData?.summaryStatus === 'FAILED') return 'failed';
    if (transcriptData?.transcriptStatus === 'FAILED') return 'failed';
    if (activeRecording?.summaryStatus === 'PROCESSING' || isSummaryLoading || isTranscriptLoading) return 'processing';
    return 'idle';
  }, [isSummaryLoading, isTranscriptLoading, activeRecording, summaryData, transcriptData]);

  const summaryErrorMessage = summaryError
    ? 'Unable to load summary for this recording.'
    : transcriptData?.transcriptStatus === 'FAILED'
      ? 'Transcription did not complete for this recording, so no summary was generated. Check the server logs for the AI provider error.'
      : hasNoAiOutput
        ? null
        : !summaryData && transcriptData?.transcriptText
          ? null
          : null;

  // ==========================================
  // VIEW 1: All Meeting Summaries Hub (when no id in URL)
  // ==========================================
  if (!targetMeetingId) {
    return (
      <div className="w-full bg-background text-foreground min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/meetings')}
              className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Meetings</span>
            </Button>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xs bg-primary/10 text-primary border border-primary/20">
                <Sparkles size={18} />
              </span>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">
                  AI Meeting Summaries
                </h1>
                <p className="text-xs text-muted-foreground">
                  Browse AI-generated summaries, transcripts, action items and executive notes for all your meetings.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search meeting summaries by title or code..."
                className="pl-8 pr-8 h-9 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded-xs"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Status Filter */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium shrink-0">
                <ListFilter size={13} className="text-primary" />
                Status:
              </span>
              <div className="w-32">
                <SearchableSelect
                  value={statusFilter}
                  onChange={(val) => {
                    setStatusFilter(val || 'all');
                    setPage(1);
                  }}
                  options={[
                    { value: 'all', label: 'All Sessions' },
                    { value: 'ready', label: 'Summary Ready' },
                  ]}
                  placeholder="All"
                  searchPlaceholder="Filter..."
                  className="w-full text-xs"
                />
              </div>
            </div>

            {/* Project Filter */}
            {projects.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium shrink-0">
                  <FolderGit2 size={13} />
                  Project:
                </span>
                <div className="w-44">
                  <SearchableSelect
                    value={filterProject}
                    onChange={(val) => {
                      setFilterProject(val || '');
                      if (filterTeam && filterTeam !== 'NONE') {
                        const matchedTeam = (teams ?? []).find((t) => ((t.teamId || t._id) as string) === filterTeam);
                        if (matchedTeam) {
                          const pObj = typeof matchedTeam.projectId === 'object' && matchedTeam.projectId !== null ? (matchedTeam.projectId as Record<string, unknown>) : null;
                          const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (matchedTeam.projectId as string);
                          if (parentPId && val && parentPId !== val) {
                            setFilterTeam('');
                          }
                        }
                      }
                      setPage(1);
                    }}
                    options={projectOptions}
                    placeholder="All Projects"
                    searchPlaceholder="Filter project..."
                    className="w-full text-xs"
                  />
                </div>
              </div>
            )}

            {/* Team Filter */}
            {teams.length > 0 && (
              <div className="flex items-center gap-2 shrink-0 min-w-[190px]">
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium shrink-0">
                  <Users size={13} />
                  Team:
                </span>
                <div className="w-40">
                  <SearchableSelect
                    value={filterTeam}
                    onChange={(val) => {
                      setFilterTeam(val || '');
                      setPage(1);
                      if (val) {
                        const matchedTeam = teams.find((t) => ((t.teamId || t._id) as string) === val);
                        const pObj = typeof matchedTeam?.projectId === 'object' && matchedTeam?.projectId !== null ? (matchedTeam.projectId as Record<string, unknown>) : null;
                        const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (matchedTeam?.projectId as string);
                        if (parentPId) setFilterProject(parentPId);
                      }
                    }}
                    options={teamOptions}
                    placeholder="All Teams"
                    searchPlaceholder="Filter team..."
                    className="w-full text-xs"
                    align="right"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content Grid */}
        {isMeetingsLoading || isRecordingsListLoading ? (
          <div className="min-h-[300px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" />
            <span className="text-xs font-medium">Loading meeting summaries...</span>
          </div>
        ) : filteredHubItems.length === 0 ? (
          <div className="rounded-xs border border-border/80 bg-muted/20 p-12 text-center space-y-3">
            <div className="size-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <h2 className="text-sm font-bold text-foreground">No Meeting Summaries Found</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {searchQuery || filterProject || filterTeam || statusFilter !== 'all'
                ? 'No summaries match the current filters. Try resetting the search or filters.'
                : 'No meetings have completed AI summaries yet. Complete or record a meeting session with captions to generate summaries.'}
            </p>
            {(searchQuery || filterProject || filterTeam || statusFilter !== 'all') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterProject('');
                  setFilterTeam('');
                  setStatusFilter('all');
                }}
                className="text-xs cursor-pointer rounded-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedHubItems.map((item) => {
                const pMatch = item.projectId ? projects.find((p) => getProjectId(p) === item.projectId) : null;
                const pLabel = pMatch ? getProjectCode(pMatch) || getProjectName(pMatch) : null;
                const tMatch = item.teamId ? teams.find((t) => (t.teamId || t._id) === item.teamId) : null;
                const tLabel = tMatch ? ((tMatch.teamName || tMatch.name) as string) : null;
                const schedStr = item.scheduledAt ? formatDateTimeStr(new Date(item.scheduledAt)) : 'N/A';

                return (
                  <Card
                    key={item.meetingId}
                    className="rounded-xs border border-border/80 bg-card hover:border-primary/50 transition-all shadow-xs flex flex-col justify-between group overflow-hidden"
                  >
                    <CardHeader className="p-4 pb-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {pLabel ? (
                            <Badge tone="neutral" className="gap-1 text-[10px] font-mono shrink-0">
                              <FolderGit2 size={10} className="text-primary" />
                              <span className="truncate">{pLabel}</span>
                            </Badge>
                          ) : tLabel ? (
                            <Badge tone="neutral" className="gap-1 text-[10px] shrink-0">
                              <Users size={10} className="text-primary" />
                              <span className="truncate">{tLabel}</span>
                            </Badge>
                          ) : (
                            <Badge tone="neutral" className="gap-1 text-[10px] shrink-0 text-muted-foreground">
                              <Building2 size={10} />
                              <span>Org Meeting</span>
                            </Badge>
                          )}
                        </div>
                        <Badge
                          tone={item.hasSummary ? 'success' : 'neutral'}
                          className="text-[10px] shrink-0 font-medium"
                        >
                          {item.hasSummary ? 'Summary Ready' : 'Pending'}
                        </Badge>
                      </div>

                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {item.meetingTitle}
                      </h3>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-muted-foreground/70 shrink-0" />
                          <span className="truncate">{schedStr}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-muted-foreground/70 shrink-0" />
                            <span>{formatDurationHuman(item.durationMinutes || 30)}</span>
                          </div>
                          {item.meetingJoinCode && (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground/80">
                              <Hash size={11} className="text-primary/70 shrink-0" />
                              <span>{item.meetingJoinCode}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {item.hasSummary ? 'Complete AI Summary' : 'Captions Captured'}
                        </span>
                        <Link
                          to={`/meetings/${item.meetingId}/summary`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                        >
                          <span>View Summary</span>
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination Component */}
            <div className="pt-2 border-t border-border/60">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredHubItems.length}
                pageSize={pageSize}
                pageSizeOptions={[6, 12, 24, 48]}
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Specific Meeting Detail View (when meetingId is in URL)
  // ==========================================
  return (
    <div className="w-full bg-background text-foreground min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Actions Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/meetings/summary')}
            className="h-8 px-2.5 gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer rounded-xs"
          >
            <ArrowLeft size={13} />
            <span>Back</span>
          </Button>

          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-primary shrink-0" />
            <h1 className="text-base sm:text-lg font-bold text-foreground">
              AI Meeting Summary
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {meeting?.meetingJoinCode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/meetings/join/${meeting.meetingJoinCode}`)}
              className="h-8 px-3 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 cursor-pointer rounded-xs"
              title="Jump to this meeting room"
            >
              <Video size={13} className="text-primary" />
              <span>Jump to Meeting</span>
              <ExternalLink size={11} className="opacity-70" />
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-8 px-3 gap-1.5 text-xs cursor-pointer rounded-xs"
          >
            {copiedLink ? <Check size={13} className="text-primary" /> : <Share2 size={13} />}
            <span>{copiedLink ? 'Copied Link' : 'Share'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!summaryData?.summaryText}
            className="h-8 px-3.5 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 rounded-xs"
          >
            <FileDown size={14} />
            <span>Export PDF</span>
          </Button>
        </div>
      </div>

      {/* PRINT-ONLY HEADER FOR PDF GENERATION */}
      <div className="hidden print:block mb-6 border-b-2 border-primary/30 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
              <Sparkles size={20} className="text-primary" />
              <span>{orgName}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              IntellMeet AI Executive Meeting Summary
            </div>
          </div>

          <div className="text-right text-xs space-y-0.5">
            <div className="font-semibold text-foreground">Exported by: {exporterName}</div>
            <div className="text-muted-foreground">{exporterEmail} ({exporterRole})</div>
            <div className="text-[11px] text-muted-foreground/80">Exported: {exportDateStr}</div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-sm text-foreground">{meeting?.meetingTitle}</span>
            <div className="text-muted-foreground font-mono text-[11px]">
              Meeting ID: {meeting?.meetingId || id} &bull; Join Code: {meeting?.meetingJoinCode || 'N/A'}
            </div>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Scheduled: </span>
            <span className="font-medium text-foreground">{scheduledDateStr}</span>
          </div>
        </div>
      </div>

      {isLoadingOverall ? (
        <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={24} className="animate-spin text-primary" />
          <span className="text-xs font-medium">Loading meeting data and AI summaries...</span>
        </div>
      ) : meetingError || !meeting ? (
        <div className="rounded-xs border border-border/80 bg-muted/20 p-8 text-center space-y-3">
          <div className="size-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <h2 className="text-sm font-bold text-foreground">No Meeting Summary Available Yet</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            The requested meeting could not be loaded or has not completed an AI summary.
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate('/meetings/summary')} className="mt-3 text-xs cursor-pointer rounded-xs">
            Back to All Summaries
          </Button>
        </div>
      ) : (
        /* Main Two-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Meeting AI Summary */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-4">
            <div className="print:hidden space-y-1">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {meeting.meetingTitle}
              </h2>
              {meeting.meetingDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {meeting.meetingDescription}
                </p>
              )}
            </div>

            {!activeRecording ? (
              <Card className="w-full rounded-xs border-dashed border-border/80 bg-muted/20 shadow-none">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">No Recording or Summary Saved Yet</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      AI Summaries are automatically generated when meetings are recorded and speech-to-text is processed.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : isTranscriptLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-xs" />
                <Skeleton className="h-64 w-full rounded-xs" />
              </div>
            ) : (
              <div className="space-y-4">
                {(!summaryData || summaryData.summaryStatus !== 'READY') && transcriptData?.transcriptText && (
                  <Card className="w-full rounded-xs border-primary/30 bg-primary/5 p-4 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">AI Summary Not Generated</div>
                          <div className="text-[11px] text-muted-foreground">
                            A live transcript was captured for this meeting. You can generate an AI summary on demand now.
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={isGeneratingSummary}
                        onClick={handleGenerateSummary}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 h-8 shrink-0 cursor-pointer shadow-xs rounded-xs"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>Generate AI Summary</span>
                          </>
                        )}
                      </Button>
                    </div>
                    {generateError && (
                      <div className="mt-2 text-[11px] text-destructive">
                        {generateError}
                      </div>
                    )}
                  </Card>
                )}

                <MeetingAiSummaryCard
                  stage={summaryStage}
                  error={summaryErrorMessage}
                  summary={summaryData}
                  transcript={transcriptData}
                  title="AI Meeting Executive Summary"
                  className="w-full rounded-xs border-border bg-card shadow-xs"
                />
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Meeting details and participant roster */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-6">
            <Card className="rounded-xs border-border bg-card shadow-xs">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span>Meeting Session Details</span>
                  {meeting.meetingStatus && (
                    <Badge tone={getMeetingStatusTone(meeting.meetingStatus)} className="text-[10px]">
                      {meeting.meetingStatus}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px] uppercase tracking-wider font-semibold">
                    Title
                  </span>
                  <div className="font-bold text-foreground text-sm">{meeting.meetingTitle}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/30">
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <Hash size={11} />
                      Join Code
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      {meeting.meetingJoinCode}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <Clock size={11} />
                      Duration
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatDurationHuman(meeting.meetingDurationMinutes || 30)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-border/30">
                  <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                    <Calendar size={11} />
                    Scheduled Date & Time
                  </span>
                  <span className="font-medium text-foreground">{scheduledDateStr}</span>
                </div>

                <div className="pt-1 border-t border-border/30 flex flex-wrap gap-2">
                  {(pCode || pName) ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-muted/60 border border-border/80 text-foreground font-mono text-xs">
                      <FolderGit2 size={11} className="text-primary shrink-0" />
                      <span>{pCode || pName}</span>
                    </span>
                  ) : tName ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-muted/60 border border-border/80 text-foreground text-xs">
                      <Users size={11} className="text-primary shrink-0" />
                      <span>{tName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-muted/40 border border-border/60 text-muted-foreground text-xs">
                      <Building2 size={11} />
                      <span>Organization Meeting</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-xs border border-border bg-card shadow-xs overflow-hidden">
              <MemberRoster
                members={participantMembers}
                value={rosterRoleValues}
                onChange={() => { }}
                title="Meeting Member Roster"
                entityName="meeting"
                canManage={false}
                canViewEmail={true}
                minHeight="280px"
                className="border-0 shadow-none rounded-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
