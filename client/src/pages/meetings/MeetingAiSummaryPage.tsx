import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Video
} from 'lucide-react';
import { getMeetings, getMeetingById } from '@/api/meeting/meeting.api';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { getProjectId, getProjectName, getProjectCode } from '@/types/project.types';
import { formatDurationHuman } from '@/utils/duration';
import { MemberRoster } from '@/components/members/MemberRoster';
import { MeetingAiSummaryCard } from '@/components/meetings/MeetingAiSummaryCard';
import type { RecorderStage } from '@/hooks/useMeetingRecorder';

export const MeetingAiSummaryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { org, members: orgMembers } = useOrganization();
  const { projects } = useProject();
  const { teams } = useTeams();
  const { formatDateTimeStr } = useTimeFormat();

  const [copiedLink, setCopiedLink] = React.useState(false);

  // 1. Fetch all past/completed meetings if no direct ID is in the URL
  const { data: allMeetingsList } = useQuery({
    queryKey: ['meetings', 'all-for-summary'],
    queryFn: async () => {
      const res = await getMeetings({ limit: 50 });
      return res.data.data || [];
    },
    enabled: !id,
  });

  // 2. Fetch all recordings to identify meetings with ready summaries
  const { data: allRecordingsData } = useQuery({
    queryKey: ['recordings', 'all-for-summary'],
    queryFn: async () => {
      const res = await getRecordings({ limit: 50 });
      return res.recordings || [];
    },
    enabled: !id,
  });

  // Resolve target meeting ID (either route param or the latest meeting with a ready summary or latest past meeting)
  const targetMeetingId = useMemo(() => {
    if (id) return id;
    if (allRecordingsData && allRecordingsData.length > 0) {
      const recordingWithSummary = allRecordingsData.find(
        (r) => r.meetingId && r.summaryStatus === 'READY'
      );
      if (recordingWithSummary?.meetingId) return recordingWithSummary.meetingId;
      const anyRecordedMeeting = allRecordingsData.find((r) => r.meetingId);
      if (anyRecordedMeeting?.meetingId) return anyRecordedMeeting.meetingId;
    }
    if (allMeetingsList && allMeetingsList.length > 0) {
      const completed = allMeetingsList.find((m) => m.meetingStatus === 'ENDED');
      if (completed?.meetingId) return completed.meetingId;
      return allMeetingsList[0]?.meetingId;
    }
    return undefined;
  }, [id, allRecordingsData, allMeetingsList]);

  // 3. Fetch Specific Meeting Details
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

  // 4. Fetch Recordings for this meeting to find the latest completed recording with AI summary
  const {
    data: recordingsData,
    isLoading: isRecordingsLoading,
  } = useQuery({
    queryKey: ['recordings', 'meeting', targetMeetingId],
    queryFn: async () => {
      if (!targetMeetingId) return [];
      const res = await getRecordings({ meetingId: targetMeetingId });
      return res.recordings || [];
    },
    enabled: Boolean(targetMeetingId),
  });

  const activeRecording: RecordingWithAiStatus | undefined = useMemo(() => {
    if (!recordingsData || recordingsData.length === 0) return undefined;
    const ready = recordingsData.find((r) => r.summaryStatus === 'READY');
    return ready || recordingsData[0];
  }, [recordingsData]);

  // 3. Fetch Summary if recording exists
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useQuery<MeetingSummary | null>({
    queryKey: ['recording-summary', activeRecording?.recordingId],
    queryFn: async () => {
      if (!activeRecording?.recordingId) return null;
      return await getRecordingSummary(activeRecording.recordingId);
    },
    enabled: Boolean(activeRecording?.recordingId),
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.summaryStatus;
      if (status === 'READY' || status === 'FAILED') return false;
      return 5_000;
    },
  });

  // 4. Fetch Transcript if recording exists
  const {
    data: transcriptData,
    isLoading: isTranscriptLoading,
  } = useQuery<Transcript | null>({
    queryKey: ['recording-transcript', activeRecording?.recordingId],
    queryFn: async () => {
      if (!activeRecording?.recordingId) return null;
      return await getRecordingTranscript(activeRecording.recordingId);
    },
    enabled: Boolean(activeRecording?.recordingId),
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.transcriptStatus;
      if (status === 'READY' || status === 'FAILED') return false;
      return 5_000;
    },
  });

  // Resolve Project & Team details. The ids are read once so each memo depends
  // on a plain value rather than `meeting`, which the compiler cannot match up.
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

  // Participant members mapped accurately
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

  // Roster role values for prebuilt MemberRoster component
  const rosterRoleValues = useMemo<Record<string, 'Host' | 'Member'>>(() => {
    const map: Record<string, 'Host' | 'Member'> = {};
    participantMembers.forEach((m) => {
      map[m.userId] = (m.userRole || '').toUpperCase() === 'HOST' ? 'Host' : 'Member';
    });
    return map;
  }, [participantMembers]);

  const scheduledDate = meeting?.meetingScheduledAt ? new Date(meeting.meetingScheduledAt) : null;
  const scheduledDateStr = scheduledDate && !isNaN(scheduledDate.getTime())
    ? formatDateTimeStr(scheduledDate)
    : 'Not scheduled';

  const exportDateStr = formatDateTimeStr(new Date());

  const orgName = org?.name || 'IntellMeet Workspace';
  const exporterName = user?.userName || 'Team Member';
  const exporterEmail = user?.userEmail || '';
  const exporterRole = user?.userRole || 'Member';

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (!meeting?.meetingJoinCode) return;
    const url = window.location.href;
    void navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isLoadingOverall = isMeetingLoading || isRecordingsLoading;

  // Derive recorder stage for MeetingAiSummaryCard
  const summaryStage: RecorderStage = useMemo(() => {
    if (activeRecording?.summaryStatus === 'READY' || summaryData?.summaryStatus === 'READY') return 'ready';
    if (activeRecording?.summaryStatus === 'FAILED' || summaryData?.summaryStatus === 'FAILED') return 'failed';
    if (activeRecording?.summaryStatus === 'PROCESSING' || isSummaryLoading || isTranscriptLoading) return 'processing';
    if (activeRecording && !summaryData) return 'processing';
    return 'idle';
  }, [isSummaryLoading, isTranscriptLoading, activeRecording, summaryData]);

  const summaryErrorMessage = summaryError
    ? 'Unable to load summary for this recording.'
    : !activeRecording
    ? null
    : null;

  return (
    <div className="w-full bg-background text-foreground min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Actions Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden border-b border-border/40 pb-4">
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

          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-sm bg-primary/10 text-primary border border-primary/20">
              <Sparkles size={16} />
            </span>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                AI Meeting Summary
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Executive notes, key points, action items and participant roster
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {meeting?.meetingJoinCode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/meetings/join/${meeting.meetingJoinCode}`)}
              className="h-8 px-3 gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 cursor-pointer"
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
            className="h-8 px-3 gap-1.5 text-xs cursor-pointer"
          >
            {copiedLink ? <Check size={13} className="text-primary" /> : <Share2 size={13} />}
            <span>{copiedLink ? 'Copied Link' : 'Share'}</span>
          </Button>

          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!summaryData?.summaryText}
            className="h-8 px-3.5 gap-1.5 text-xs font-semibold cursor-pointer shadow-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
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
        <div className="rounded-sm border border-border/80 bg-muted/20 p-8 text-center space-y-3">
          <div className="size-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <h2 className="text-sm font-bold text-foreground">No Meeting Summary Available Yet</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {id
              ? 'The requested meeting could not be loaded or has not completed an AI summary.'
              : 'No recorded meetings with completed AI summaries were found in your organization yet. Once a meeting ends with recording, its full summary will be featured here.'}
          </p>
          <Button size="sm" variant="outline" onClick={() => navigate('/meetings')} className="mt-3 text-xs cursor-pointer">
            View All Meetings
          </Button>
        </div>
      ) : (
        /* Main Two-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Meeting AI Summary (Prebuilt MeetingAiSummaryCard) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Page / Section Header info */}
            <div className="print:hidden space-y-1">
              <div className="flex items-center gap-2">
                <Badge tone="neutral" className="gap-1 text-[11px] font-mono">
                  <Hash size={11} className="text-primary" />
                  <span>{meeting.meetingJoinCode}</span>
                </Badge>
                {meeting.meetingStatus && (
                  <Badge tone={getMeetingStatusTone(meeting.meetingStatus)} className="text-[10px]">
                    {meeting.meetingStatus}
                  </Badge>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {meeting.meetingTitle}
              </h2>
              {meeting.meetingDescription && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {meeting.meetingDescription}
                </p>
              )}
            </div>

            {/* Prebuilt AI Summary Card */}
            {!activeRecording ? (
              <Card className="w-full rounded-sm border-dashed border-border/80 bg-muted/20 shadow-none">
                <CardContent className="p-8 text-center space-y-3">
                  <div className="size-10 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-foreground">No Recording or Summary Saved Yet</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      AI Summaries are automatically generated when meetings are recorded and speech-to-text is processed.
                      Start or finish a recorded session to view its comprehensive summary here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <MeetingAiSummaryCard
                stage={summaryStage}
                error={summaryErrorMessage}
                summary={summaryData}
                transcript={transcriptData}
                title="AI Meeting Executive Summary"
                className="w-full rounded-sm border-border bg-card shadow-xs"
              />
            )}
          </div>

          {/* RIGHT COLUMN: Top Card (Meeting Details) + Bottom Card (Member Roster Component) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* TOP CARD: Meeting Overview Card */}
            <Card className="rounded-sm border-border bg-card shadow-xs">
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

                {/* Project / Team pill */}
                <div className="pt-1 border-t border-border/30 flex flex-wrap gap-2">
                  {(pCode || pName) ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-muted/60 border border-border/80 text-foreground font-mono text-xs">
                      <FolderGit2 size={11} className="text-primary shrink-0" />
                      <span>{pCode || pName}</span>
                    </span>
                  ) : tName ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-muted/60 border border-border/80 text-foreground text-xs">
                      <Users size={11} className="text-primary shrink-0" />
                      <span>{tName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-muted/40 border border-border/60 text-muted-foreground text-xs">
                      <Building2 size={11} />
                      <span>Organization Meeting</span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* BOTTOM CARD: Prebuilt MemberRoster Component */}
            <div className="rounded-sm border border-border bg-card shadow-xs overflow-hidden">
              <MemberRoster
                members={participantMembers}
                value={rosterRoleValues}
                onChange={() => {}}
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
