import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Video, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import { DateTimePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMutation, useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { getProjects, getProjectById } from '@/api/project/project.api';
import { getTeamsApi } from '@/api/teams/teams.api';
import { createMeeting } from '@/api/meeting/meeting.api';
import { getProjectName, getProjectId, type Project } from '@/types/project.types';
import { parseApiError } from '@/utils/apiError';
import { createMeetingSchema, type CreateMeetingFormValues } from '@/schemas/meeting.schema';
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select';
import { MemberRoster } from '@/components/members/MemberRoster';
import { getRoleCategory, getMemberId } from '@/components/members/member-utils';
import { cn } from '@/lib/utils';


export const CreateMeeting: React.FC = () => {
  const [params] = useSearchParams();
  const lockedProjectId = params.get('projectId');
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { members } = useOrganization();
  const [assignedRoles, setAssignedRoles] = useState<Record<string, 'Host' | 'Member'>>(() => (
    user?.userId ? { [user.userId]: 'Host' } : {}
  ));

  const { data: projects, loading: projectsLoading } = useQuery<Project[]>(
    queryKeys.projects.list(),
    () => getProjects(),
    { enabled: isAuthenticated && !lockedProjectId, list: true }
  );

  const { data: teamsData } = useQuery<Record<string, unknown>[]>(
    ['teams', 'list'],
    () => getTeamsApi(),
    { enabled: isAuthenticated, list: true }
  );
  const teams = useMemo(() => teamsData || [], [teamsData]);

  // Default schedule start date/time dynamically based on current user time (rounded up to next 5 minutes)
  const [defaultStart] = useState(() => {
    const now = new Date();
    const mins = now.getMinutes();
    const roundedMins = Math.ceil(mins / 5) * 5;
    if (roundedMins === 60) {
      now.setHours(now.getHours() + 1, 0, 0, 0);
    } else {
      now.setMinutes(roundedMins, 0, 0);
    }
    return now.toISOString();
  });

  const { register, handleSubmit, setValue, getValues, control, formState: { errors } } = useForm<CreateMeetingFormValues>({
    resolver: zodResolver(createMeetingSchema),
    defaultValues: {
      projectId: lockedProjectId ?? '',
      teamId: '',
      meetingTitle: '',
      meetingDescription: '',
      meetingScheduledAt: defaultStart,
      meetingDurationMinutes: 360,
      meetingJoinMode: 'INVITE_ONLY',
      meetingParticipantLimit: 50,
    },
  });

  const watchedProjectId = useWatch({ control, name: 'projectId' });
  const watchedTeamId = useWatch({ control, name: 'teamId' });
  const watchedDuration = useWatch({ control, name: 'meetingDurationMinutes' }) || 360;
  const selectedProjectId = lockedProjectId || watchedProjectId;

  const projectOptions = useMemo<SearchableSelectOption[]>(() => {
    return (projects ?? []).map((p) => {
      const pId = getProjectId(p) || '';
      const pName = getProjectName(p) || 'Unnamed Project';
      return {
        value: pId,
        label: pName,
      };
    });
  }, [projects]);

  const teamOptions = useMemo<SearchableSelectOption[]>(() => {
    return (teams ?? [])
      .filter((tm) => {
        if (!selectedProjectId) return true;
        const pObj =
          typeof tm.projectId === 'object' && tm.projectId !== null
            ? (tm.projectId as unknown as Record<string, unknown>)
            : null;
        const pId = pObj ? ((pObj._id || pObj.projectId) as string) : (tm.projectId as string);
        return !pId || pId === selectedProjectId;
      })
      .map((tm) => {
        const tmId = (tm.teamId || tm._id) as string;
        const tmName = (tm.teamName as string) || 'Unnamed Team';
        return {
          value: tmId,
          label: tmName,
        };
      });
  }, [teams, selectedProjectId]);

  // Compute sub-team member IDs if a team is selected
  const activeTeamMemberIds = useMemo<Set<string> | null>(() => {
    if (!watchedTeamId || watchedTeamId === 'NONE') return null;
    const tObj = teams.find((t) => ((t.teamId || t._id) as string) === watchedTeamId);
    if (!tObj) return null;

    const set = new Set<string>();
    const hosts = (tObj.hosts as unknown[]) || [];
    const membersList = (tObj.members as unknown[]) || [];

    const extractId = (entry: unknown): string | undefined => {
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'object' && entry !== null) {
        const obj = entry as Record<string, unknown>;
        return (obj.userId || obj._id) as string | undefined;
      }
      return undefined;
    };

    [...hosts, ...membersList].forEach((m) => {
      const idStr = extractId(m);
      if (idStr) set.add(idStr);
    });

    return set;
  }, [teams, watchedTeamId]);

  // Fetch full project details (including project_members and hosts) for the selected project
  const { data: selectedProjectDetails } = useQuery<Project>(
    queryKeys.projects.detail(selectedProjectId || ''),
    () => getProjectById(selectedProjectId || ''),
    { enabled: isAuthenticated && Boolean(selectedProjectId) }
  );

  const activeProject = selectedProjectDetails || projects?.find((p) => getProjectId(p) === selectedProjectId);
  const activeProjectName = activeProject ? getProjectName(activeProject) : undefined;
  const activeProjectStatus = (activeProject?.projectStatus || activeProject?.status || '').toLowerCase();
  const isProjectReadOnly = activeProjectStatus === 'completed' || activeProjectStatus === 'archived';

  // Extract set of user IDs assigned to this project
  const projectMemberIds = useMemo<Set<string>>(() => {
    const set = new Set<string>();
    if (!activeProject) return set;

    const extractId = (entry: unknown): string | undefined => {
      if (typeof entry === 'string') return entry;
      if (typeof entry === 'object' && entry !== null) {
        const obj = entry as Record<string, unknown>;
        return (obj.id || obj._id || obj.userId) as string | undefined;
      }
      return undefined;
    };

    const hosts = Array.isArray(activeProject.hosts) ? activeProject.hosts : [];
    const membersList = Array.isArray(activeProject.members) ? activeProject.members : [];
    const rawProjectMembers = Array.isArray((activeProject as unknown as Record<string, unknown>).project_members)
      ? ((activeProject as unknown as Record<string, unknown>).project_members as unknown[])
      : [];

    [...hosts, ...membersList, ...rawProjectMembers].forEach((m) => {
      const idStr = extractId(m);
      if (idStr) set.add(idStr);
    });

    return set;
  }, [activeProject]);

  // Data isolation filter: show only members assigned to this team (or project if no team selected) (+ SuperAdmin/Admin)
  const projectFilteredMembers = useMemo(() => {
    if (!members) return [];
    if (!selectedProjectId) return members;

    return members.filter((m) => {
      const mId = getMemberId(m);
      const category = getRoleCategory(m);

      // SuperAdmin and Admin have global access across projects/meetings
      if (category === 'SUPER_ADMIN' || category === 'ADMIN' || m.isSuperAdmin) {
        return true;
      }

      if (!mId) return false;

      // If a specific sub-team is selected, restrict candidate pool to that team
      if (activeTeamMemberIds) {
        return activeTeamMemberIds.has(mId);
      }

      // Otherwise, show all project members
      return projectMemberIds.has(mId);
    });
  }, [members, selectedProjectId, projectMemberIds, activeTeamMemberIds]);

  const defaultEnd = useMemo(() => {
    const startDate = new Date(defaultStart);
    const baseTime = !isNaN(startDate.getTime()) ? startDate.getTime() : 0;
    return new Date(baseTime + 6 * 60 * 60 * 1000).toISOString();
  }, [defaultStart]);

  const [meetingEndAt, setMeetingEndAt] = useState<string>(defaultEnd);

  useEffect(() => {
    setValue('meetingScheduledAt', defaultStart);
  }, [defaultStart, setValue]);

  // Only pre-assign creator as Host by default
  const seededCreatorRef = useRef(Boolean(user?.userId));
  useEffect(() => {
    if (!seededCreatorRef.current && user?.userId) {
      seededCreatorRef.current = true;
      const timer = setTimeout(() => {
        setAssignedRoles((prev) => (user.userId in prev ? prev : { [user.userId]: 'Host', ...prev }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [user?.userId]);

  const handleStartChange = (newStartIso: string) => {
    setValue('meetingScheduledAt', newStartIso);
    const start = new Date(newStartIso);
    if (!isNaN(start.getTime())) {
      const currentDuration = getValues('meetingDurationMinutes') || 360;
      const newEnd = new Date(start.getTime() + currentDuration * 60 * 1000);
      setMeetingEndAt(newEnd.toISOString());
    }
  };

  const handleEndChange = (newEndIso: string) => {
    let end = new Date(newEndIso);
    const startVal = getValues('meetingScheduledAt');
    const start = new Date(startVal);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      let diffMs = end.getTime() - start.getTime();
      // Auto-advance by 1 day if selected time on the same date is earlier than start time (e.g. crossing midnight)
      if (diffMs <= 0 && end.toDateString() === start.toDateString()) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
        diffMs = end.getTime() - start.getTime();
      }
      setMeetingEndAt(end.toISOString());
      if (diffMs > 0) {
        const durationMins = Math.min(1440, Math.max(1, Math.round(diffMs / (60 * 1000))));
        setValue('meetingDurationMinutes', durationMins, { shouldValidate: true });
      } else {
        setValue('meetingDurationMinutes', 0, { shouldValidate: true });
      }
    } else {
      setMeetingEndAt(newEndIso);
    }
  };

  const create = useMutation<unknown, CreateMeetingFormValues>({
    invalidates: [queryKeys.meetings.all],
    mutationFn: (values) =>
      createMeeting({
        projectId: lockedProjectId || (values.projectId ? values.projectId : undefined),
        teamId: values.teamId || undefined,
        meetingTitle: values.meetingTitle.trim(),
        meetingDescription: values.meetingDescription?.trim(),
        meetingScheduledAt: new Date(values.meetingScheduledAt).toISOString(),
        meetingDurationMinutes: Number(values.meetingDurationMinutes),
        meetingJoinMode: values.meetingJoinMode,
        meetingParticipantLimit: Number(values.meetingParticipantLimit),
        participantIds: Object.keys(assignedRoles),
      }),
    onSuccess: () => {
      navigate('/meetings');
    },
  });

  const lockedProject = projects?.find((project) => getProjectId(project) === lockedProjectId);

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="w-full space-y-6">
        {/* Top Header Row with Title and Inline Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
              <Video size={24} className="text-emerald-500" />
              <span>Schedule a Meeting</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              Plan and configure a new video meeting session with optional member pre-assignment.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/meetings')}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back to Meetings</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit((values) => create.mutate(values as CreateMeetingFormValues))}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* LEFT COLUMN: Meeting Details Form Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lockedProjectId ? (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 p-3">
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
                    label="Project (Optional)"
                    htmlFor="meeting-project"
                    error={errors.projectId?.message}
                  >
                    {projectsLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Controller
                        control={control}
                        name="projectId"
                        render={({ field }) => (
                          <SearchableSelect
                            id="meeting-project"
                            value={field.value}
                            options={projectOptions}
                            placeholder="Select project (Optional)"
                            searchPlaceholder="Search projects..."
                            onChange={(val) => {
                              field.onChange(val);
                              if (watchedTeamId) {
                                const matchedTeam = (teams ?? []).find((t) => ((t.teamId || t._id) as string) === watchedTeamId);
                                if (matchedTeam) {
                                  const pObj = typeof matchedTeam.projectId === 'object' && matchedTeam.projectId !== null ? (matchedTeam.projectId as Record<string, unknown>) : null;
                                  const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (matchedTeam.projectId as string);
                                  if (parentPId && parentPId !== val) {
                                    setValue('teamId', '');
                                  }
                                }
                              }
                              setAssignedRoles({});
                            }}
                          />
                        )}
                      />
                    )}
                  </FormField>
                )}

                <FormField label="Assigned Team (Optional)" htmlFor="meeting-team" error={errors.teamId?.message}>
                  <Controller
                    control={control}
                    name="teamId"
                    render={({ field }) => (
                      <SearchableSelect
                        id="meeting-team"
                        value={field.value || ''}
                        options={teamOptions}
                        placeholder="Select Assigned Team (Optional)"
                        searchPlaceholder="Search teams..."
                        allowClear={true}
                        clearLabel="No Specific Team (Project Alone)"
                        onChange={(val) => {
                          field.onChange(val);
                          setAssignedRoles({});
                          if (val) {
                            const matchedTeam = (teams ?? []).find((t) => ((t.teamId || t._id) as string) === val);
                            if (matchedTeam) {
                              const pObj = typeof matchedTeam.projectId === 'object' && matchedTeam.projectId !== null ? (matchedTeam.projectId as Record<string, unknown>) : null;
                              const parentPId = pObj ? ((pObj.projectId || pObj._id) as string) : (matchedTeam.projectId as string);
                              if (parentPId && parentPId !== selectedProjectId) {
                                setValue('projectId', parentPId, { shouldValidate: true });
                              }
                            }
                          }
                        }}
                      />
                    )}
                  />
                </FormField>
              </div>

              <FormField label="Title" htmlFor="meeting-title" required error={errors.meetingTitle?.message}>
                <Input id="meeting-title" {...register('meetingTitle')} />
              </FormField>

              <FormField
                label="Description"
                htmlFor="meeting-description"
                error={errors.meetingDescription?.message}
              >
                <Textarea id="meeting-description" rows={3} {...register('meetingDescription')} />
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
                        onChange={(val) => {
                          field.onChange(val);
                          handleStartChange(val);
                        }}
                      />
                    )}
                  />
                </FormField>

                <FormField
                  label="Schedule End Date & Time"
                  htmlFor="meeting-end"
                  required
                >
                  <DateTimePicker
                    id="meeting-end"
                    value={meetingEndAt}
                    onChange={handleEndChange}
                  />
                </FormField>

                <div
                  className={cn(
                    'flex items-center justify-between text-xs px-3.5 py-2.5 rounded-md border',
                    watchedDuration > 0
                      ? 'bg-muted/40 border-border/70'
                      : 'bg-destructive/10 border-destructive/30 text-destructive'
                  )}
                >
                  <span className="font-medium">
                    {watchedDuration > 0 ? 'Calculated Duration:' : 'Invalid Time Selection:'}
                  </span>
                  {watchedDuration > 0 ? (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.floor(watchedDuration / 60) > 0 ? `${Math.floor(watchedDuration / 60)}h ` : ''}
                      {watchedDuration % 60 > 0 || Math.floor(watchedDuration / 60) === 0 ? `${watchedDuration % 60}m` : ''}
                      {' '}({watchedDuration} minutes)
                    </span>
                  ) : (
                    <span className="font-bold text-destructive">
                      End date & time must be after start date & time
                    </span>
                  )}
                </div>
              </div>

              {isProjectReadOnly && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Project is Read-Only ({activeProjectStatus.toUpperCase()})</p>
                    <p className="text-[11px] leading-relaxed">
                      This project is currently marked as <strong>{activeProjectStatus}</strong>. Scheduling new meetings is disabled. An Admin or SuperAdmin must change the project status to <strong>Active</strong> before scheduling new meetings.
                    </p>
                  </div>
                </div>
              )}

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
                <Button
                  type="submit"
                  disabled={create.pending || isProjectReadOnly || watchedDuration <= 0}
                  className="gap-2"
                >
                  <Video size={15} />
                  <span>{create.pending ? 'Scheduling…' : 'Schedule Meeting'}</span>
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Pre-assign Members List using common MemberRoster */}
            <div className="lg:col-span-5">
              <MemberRoster
                members={projectFilteredMembers}
                value={assignedRoles}
                onChange={setAssignedRoles}
                title="Pre-assign Members & Roles"
                searchPlaceholder="Search team members by name or email..."
                entityName="meeting"
                projectName={activeProjectName}
                lockSuperAdmin={true}
                maxHosts={3}
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMeeting;
