import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Lock, Video, Users, UserPlus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { getProjects } from '@/api/project/project.api';
import { createMeeting } from '@/api/meeting/meeting.api';
import { getProjectName, getProjectId } from '@/types/project.types';
import { parseApiError } from '@/utils/apiError';
import { createMeetingSchema, type CreateMeetingFormValues } from '@/schemas/meeting.schema';
import type { Project } from '@/types/project.types';
import type { Member } from '@/types/member.types';

const JOIN_MODE_OPTIONS = [
  { value: 'INVITE_ONLY', label: 'Invite Only (Assigned Project Members)' },
  { value: 'OPEN_LINK', label: 'Open Link (Anyone with Account)' },
];

/** HTML datetime-local needs "YYYY-MM-DDTHH:mm"; the server wants a real Date. */
const toLocalInputValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const CreateMeeting: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { members } = useOrganization();
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const lockedProjectId = params.get('projectId');

  const { data: projects, loading: projectsLoading } = useQuery<Project[]>(
    queryKeys.projects.list(),
    () => getProjects(),
    { enabled: isAuthenticated && !lockedProjectId, list: true }
  );

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm<CreateMeetingFormValues>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      projectId: lockedProjectId ?? '',
      meetingTitle: '',
      meetingDescription: '',
      meetingScheduledAt: '',
      meetingDurationMinutes: 30,
      meetingJoinMode: 'INVITE_ONLY',
      meetingParticipantLimit: 50,
    },
  });

  // Default the schedule an hour out, rounded up to the next 5 minutes.
  useEffect(() => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5, 0, 0);
    setValue('meetingScheduledAt', toLocalInputValue(start));
  }, [setValue]);

  // Fix project select initialization using getProjectId
  useEffect(() => {
    if (!lockedProjectId && projects && projects.length > 0) {
      const firstId = getProjectId(projects[0]);
      if (firstId) {
        setValue('projectId', firstId, { shouldValidate: true });
      }
    }
  }, [projects, lockedProjectId, setValue]);

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const create = useMutation<unknown, CreateMeetingFormValues>({
    invalidates: [queryKeys.meetings.all],
    mutationFn: (values) =>
      createMeeting({
        projectId: lockedProjectId ?? values.projectId,
        meetingTitle: values.meetingTitle.trim(),
        meetingDescription: values.meetingDescription?.trim(),
        meetingScheduledAt: new Date(values.meetingScheduledAt).toISOString(),
        meetingDurationMinutes: Number(values.meetingDurationMinutes),
        meetingJoinMode: values.meetingJoinMode,
        meetingParticipantLimit: Number(values.meetingParticipantLimit),
        participantIds: selectedMemberIds,
      }),
    onSuccess: () => {
      navigate('/meetings');
    },
  });

  const lockedProject = projects?.find((project) => getProjectId(project) === lockedProjectId);

  const filteredMembers = (members ?? []).filter((m) => {
    const name = m.name || m.userName || '';
    const email = m.email || m.userEmail || '';
    const query = memberSearch.toLowerCase();
    return name.toLowerCase().includes(query) || email.toLowerCase().includes(query);
  });

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Row with Title and Inline Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
              <Video size={24} className="text-emerald-500" />
              <span>Schedule a Meeting</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure meeting settings and pre-assign members.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit((values) => create.mutate(values))}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT COLUMN: Meeting Form Fields (Blended into Layout Space) */}
            <div className="lg:col-span-8 space-y-5">
              {lockedProjectId ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Project</p>
                    <p className="truncate text-sm font-bold text-foreground">
                      {lockedProject ? getProjectName(lockedProject) : lockedProjectId}
                    </p>
                  </div>
                  <Badge tone="neutral">
                    <Lock size={10} />
                    Fixed by project
                  </Badge>
                </div>
              ) : (
                <FormField
                  label="Project"
                  htmlFor="meeting-project"
                  required
                  error={errors.projectId?.message}
                >
                  {projectsLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Select
                      id="meeting-project"
                      options={(projects ?? []).map((project) => ({
                        value: getProjectId(project),
                        label: getProjectName(project),
                      }))}
                      {...register('projectId')}
                    />
                  )}
                </FormField>
              )}

              <FormField label="Title" htmlFor="meeting-title" required error={errors.meetingTitle?.message}>
                <Input id="meeting-title" placeholder="e.g. Sprint Planning, Architecture Sync" {...register('meetingTitle')} />
              </FormField>

              <FormField
                label="Description"
                htmlFor="meeting-description"
                error={errors.meetingDescription?.message}
              >
                <Input id="meeting-description" placeholder="Optional notes or agenda" {...register('meetingDescription')} />
              </FormField>

              <div className="space-y-4">
                <FormField
                  label="Schedule Start Date & Time"
                  htmlFor="meeting-start"
                  required
                  error={errors.meetingScheduledAt?.message}
                >
                  <Controller
                    control={control}
                    name="meetingScheduledAt"
                    render={({ field }) => (
                      <DateTimePicker
                        id="meeting-start"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </FormField>

                <FormField
                  label="Duration (minutes)"
                  htmlFor="meeting-duration"
                  required
                  error={errors.meetingDurationMinutes?.message}
                >
                  <Input
                    id="meeting-duration"
                    type="number"
                    min={1}
                    max={480}
                    {...register('meetingDurationMinutes', { valueAsNumber: true })}
                  />
                </FormField>
              </div>

              <FormField
                label="Who can join"
                htmlFor="meeting-join-mode"
                error={errors.meetingJoinMode?.message}
              >
                <Select id="meeting-join-mode" options={JOIN_MODE_OPTIONS} {...register('meetingJoinMode')} />
              </FormField>

              <FormField
                label="Participant limit"
                htmlFor="meeting-limit"
                error={errors.meetingParticipantLimit?.message}
              >
                <Input
                  id="meeting-limit"
                  type="number"
                  min={1}
                  max={50}
                  {...register('meetingParticipantLimit', { valueAsNumber: true })}
                />
              </FormField>

              {Boolean(create.error) && (
                <p role="alert" className="text-xs text-destructive">
                  {parseApiError(create.error).message}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/meetings')}
                  disabled={create.pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={create.pending} className="gap-2">
                  <Video size={15} />
                  <span>{create.pending ? 'Scheduling…' : 'Schedule Meeting'}</span>
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Pre-assign Members List */}
            <div className="lg:col-span-4 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-emerald-500" />
                  <h2 className="text-sm font-bold text-foreground">Pre-assign Members</h2>
                </div>
                <Badge tone={selectedMemberIds.length > 0 ? "success" : "neutral"}>
                  {selectedMemberIds.length} Selected
                </Badge>
              </div>

              <Input
                placeholder="Search team members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="text-xs"
              />

              <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
                {filteredMembers.length === 0 ? (
                  <div className="text-center py-6 text-xs text-muted-foreground">
                    No team members found in workspace.
                  </div>
                ) : (
                  filteredMembers.map((member: Member) => {
                    const memberId = member.id || member._id || member.userId || member.email;
                    const isSelected = selectedMemberIds.includes(memberId);
                    const displayName = member.name || member.userName || member.email;
                    const displayEmail = member.email || member.userEmail || '';
                    const role = member.role || member.userRole || 'Member';

                    return (
                      <div
                        key={memberId}
                        onClick={() => toggleMemberSelection(memberId)}
                        className={`flex items-center justify-between p-3 rounded-md border transition-all cursor-pointer ${isSelected
                          ? 'border-emerald-500/50 bg-emerald-500/10'
                          : 'border-border bg-card/40 hover:border-emerald-500/30'
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{displayEmail}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge tone="neutral" className="text-[10px] px-1.5 py-0">
                            {role}
                          </Badge>
                          <button
                            type="button"
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                              }`}
                          >
                            {isSelected ? <Check size={14} /> : <UserPlus size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMeeting;


