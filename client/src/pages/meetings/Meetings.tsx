import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Calendar, Clock, Users, Play, Plus } from 'lucide-react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { getProjectName } from '@/types/project.types';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getMeetingStatusTone } from '@/lib/status-tone';
import { useQuery, useMutation } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { getMeetings, createMeeting } from '@/api/meeting/meeting.api';
import type { Meeting } from '@/api/meeting/meeting.types';
import { Modal, ModalFooterCancel } from '@/components/ui/modal';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

export const Meetings: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { selectedProject, projects } = useProject();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [instantTitle, setInstantTitle] = useState('');

  const activeProjectName = getProjectName(selectedProject);
  const activeProjectId = selectedProject?.id || projects[0]?.id;

  const { data: meetings, loading } = useQuery<Meeting[]>(
    queryKeys.meetings.list(selectedProject?.id),
    () => getMeetings(selectedProject?.id ? { projectId: selectedProject.id } : undefined),
    { enabled: isAuthenticated, list: true }
  );

  const startInstantMeeting = useMutation<Meeting, { title: string }>({
    invalidates: [queryKeys.meetings.all],
    mutationFn: async ({ title }) => {
      const targetProjectId = activeProjectId;
      if (!targetProjectId) {
        throw new Error('Please create or select a project first.');
      }
      return createMeeting({
        projectId: targetProjectId,
        meetingTitle: title,
        meetingScheduledAt: new Date().toISOString(),
        meetingDurationMinutes: 30,
        meetingJoinMode: 'OPEN_LINK',
      });
    },
    onSuccess: () => {
      setCreateModalOpen(false);
      setInstantTitle('');
    },
  });

  const handleInstantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instantTitle.trim()) return;
    startInstantMeeting.mutate({ title: instantTitle.trim() });
  };

  const displayedMeetings = meetings ?? [];

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header Row: Heading & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Video size={24} className="text-emerald-500 dark:text-emerald-400" />
            <span>Meetings</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedProject
              ? `Showing meetings scheduled under project '${activeProjectName}'.`
              : 'Showing all active and scheduled meetings in your organization.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreateModalOpen(true)}
            className="gap-1.5"
          >
            <Play size={14} className="text-emerald-500" />
            <span>Instant Room</span>
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(selectedProject?.id ? `/meetings/new?projectId=${selectedProject.id}` : '/meetings/new')}
            className="gap-1.5"
          >
            <Plus size={15} />
            <span>Schedule Meeting</span>
          </Button>
        </div>
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
          title="No meetings scheduled yet"
          description={
            selectedProject
              ? `There are no video conferencing rooms scheduled for '${activeProjectName}'. Click below to schedule a meeting.`
              : 'There are no active or scheduled meetings in your workspace yet. Click below to schedule a meeting.'
          }
          actionLabel="Schedule Meeting"
          onAction={() => navigate(selectedProject?.id ? `/meetings/new?projectId=${selectedProject.id}` : '/meetings/new')}
          accentColor="emerald"
        />
      ) : (
        <div className="space-y-3">
          {displayedMeetings.map((m) => {
            const scheduledDate = new Date(m.meetingScheduledAt);
            const scheduledMs = scheduledDate.getTime();
            const dateStr = !isNaN(scheduledMs)
              ? scheduledDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : m.meetingScheduledAt;
            const participantCount = m.participants?.length || 1;

            const durationMinutes = m.meetingDurationMinutes || 30;
            const endMs = !isNaN(scheduledMs) ? scheduledMs + durationMinutes * 60 * 1000 : Infinity;
            const isPastDuration = !isNaN(scheduledMs) && Date.now() > endMs;

            const isEndedOrCancelled = m.meetingStatus === 'ENDED' || m.meetingStatus === 'CANCELLED' || isPastDuration;
            const canJoin = !isEndedOrCancelled;
            const statusLabel = isPastDuration && m.meetingStatus !== 'CANCELLED' ? 'ENDED' : m.meetingStatus;

            return (
              <div
                key={m.meetingId}
                className="rounded-md border border-border bg-card hover:border-emerald-500/30 p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={getMeetingStatusTone(statusLabel)}>{statusLabel}</Badge>
                    <Badge tone="neutral">{m.meetingJoinMode === 'INVITE_ONLY' ? 'Invite Only' : 'Open Link'}</Badge>
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
                  onClick={() => navigate(`/meetings/${m.meetingId}/room`)}
                  className="self-stretch justify-center sm:self-auto gap-1.5 disabled:opacity-50"
                >
                  <Play size={14} fill="currentColor" />
                  <span>
                    {isEndedOrCancelled ? 'Meeting Ended' : 'Join Room'}
                  </span>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Instant Meeting Modal */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Start Instant Meeting"
        description="Launch an immediate live room for your active project."
        footer={
          <>
            <ModalFooterCancel onClick={() => setCreateModalOpen(false)} />
            <Button
              type="submit"
              form="instant-meeting-form"
              disabled={startInstantMeeting.pending}
            >
              {startInstantMeeting.pending ? 'Starting…' : 'Start Room'}
            </Button>
          </>
        }
      >
        <form id="instant-meeting-form" onSubmit={handleInstantSubmit} className="space-y-4">
          <FormField label="Meeting Subject" htmlFor="instant-subject" required>
            <Input
              id="instant-subject"
              value={instantTitle}
              onChange={(e) => setInstantTitle(e.target.value)}
              placeholder="e.g. Architecture Sync, Quick Huddle"
              required
            />
          </FormField>
        </form>
      </Modal>
    </div>
  );
};

export default Meetings;

