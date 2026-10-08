import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, Video, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { MemberRoster } from '@/components/members/MemberRoster';
import { getRoleCategory, getMemberId } from '@/components/members/member-utils';


export const CreateMeeting: React.FC = () => {
  const [params] = useSearchParams();
  const lockedProjectId = params.get('projectId');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { members } = useOrganization();
  const [assignedRoles, setAssignedRoles] = useState<Record<string, 'Host' | 'Member'>>({});

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
  const teams = teamsData || [];

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
      meetingDurationMinutes: 30,
      meetingJoinMode: 'INVITE_ONLY',
      meetingParticipantLimit: 50,
    },
  });

  const watchedProjectId = useWatch({ control, name: 'projectId' });
  const watchedTeamId = useWatch({ control, name: 'teamId' });
  const selectedProjectId = lockedProjectId || watchedProjectId;

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
    return new Date(baseTime + 30 * 60 * 1000).toISOString();
  }, [defaultStart]);

  const [meetingEndAt, setMeetingEndAt] = useState<string>(defaultEnd);

  useEffect(() => {
    setValue('meetingScheduledAt', defaultStart);
  }, [defaultStart, setValue]);

  // Pre-assign SuperAdmins & Admins as Host by default
  const topAdminRoles = useMemo<Record<string, 'Host' | 'Member'>>(() => {
    const roleMap: Record<string, 'Host' | 'Member'> = {};
    projectFilteredMembers.forEach((m) => {
      const cat = getRoleCategory(m);
      if (cat === 'SUPER_ADMIN' || cat === 'ADMIN') {
        const mId = getMemberId(m);
        if (mId) roleMap[mId] = 'Host';
      }
    });
    return roleMap;
  }, [projectFilteredMembers]);

  const [seededRoles, setSeededRoles] = useState(topAdminRoles);
  if (seededRoles !== topAdminRoles) {
    setSeededRoles(topAdminRoles);
    setAssignedRoles((prev) => ({ ...topAdminRoles, ...prev }));
  }

  const handleStartChange = (newStartIso: string) => {
    setValue('meetingScheduledAt', newStartIso);
    const start = new Date(newStartIso);
    if (!isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      setMeetingEndAt(end.toISOString());
      setValue('meetingDurationMinutes', 30);
    }
  };

  const handleEndChange = (newEndIso: string) => {
    setMeetingEndAt(newEndIso);
    const startVal = getValues('meetingScheduledAt');
    const start = new Date(startVal);
    const end = new Date(newEndIso);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffMs = end.getTime() - start.getTime();
      const durationMins = Math.max(5, Math.round(diffMs / (60 * 1000)));
      setValue('meetingDurationMinutes', durationMins);
    }
  };

  // Fix project select initialization using getProjectId
  useEffect(() => {
    if (!lockedProjectId && projects && projects.length > 0) {
      const firstId = getProjectId(projects[0]);
      if (firstId) {
        setValue('projectId', firstId, { shouldValidate: true });
      }
    }
  }, [projects, lockedProjectId, setValue]);

  const create = useMutation<unknown, CreateMeetingFormValues>({
    invalidates: [queryKeys.meetings.all],
    mutationFn: (values) =>
      createMeeting({
        projectId: lockedProjectId ?? values.projectId,
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
                    label="Project"
                    htmlFor="meeting-project"
                    required
                    error={errors.projectId?.message}
                  >
                    {projectsLoading ? (
                      <Skeleton className="h-10 w-full" />
                    ) : (
                      <Controller
                        control={control}
                        name="projectId"
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(val) => {
                              if (val) {
                                field.onChange(val);
                                setValue('teamId', '');
                                setAssignedRoles({});
                              }
                            }}
                          >
                            <SelectTrigger id="meeting-project" className="w-full">
                              <SelectValue placeholder="Select project">
                                {(val: unknown) => {
                                  if (!val) return 'Select project';
                                  const selected = (projects ?? []).find((p) => getProjectId(p) === val);
                                  return selected ? getProjectName(selected) : String(val);
                                }}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {(projects ?? []).map((project) => {
                                const pId = getProjectId(project);
                                const pName = getProjectName(project);
                                return (
                                  <SelectItem key={pId} value={pId}>
                                    {pName}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
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
                      <Select
                        value={field.value || 'NONE'}
                        onValueChange={(val) => {
                          field.onChange(val === 'NONE' ? '' : val);
                          setAssignedRoles({});
                        }}
                      >
                        <SelectTrigger id="meeting-team" className="w-full">
                          <SelectValue placeholder="No Specific Team (Project Alone)">
                            {(val: unknown) => {
                              if (!val || val === 'NONE') return 'No Specific Team (Project Alone)';
                              const match = (teams ?? []).find((t) => ((t.teamId || t._id) as string) === val);
                              return match ? (match.teamName as string) : String(val);
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">No Specific Team (Project Alone)</SelectItem>
                          {(teams ?? [])
                            .filter((tm) => {
                              if (!selectedProjectId) return true;
                              const pObj =
                                typeof tm.projectId === 'object' && tm.projectId !== null
                                  ? (tm.projectId as unknown as Record<string, unknown>)
                                  : null;
                              const pId = pObj ? ((pObj._id || pObj.projectId) as string) : (tm.projectId as string);
                              return pId === selectedProjectId;
                            })
                            .map((tm) => {
                              const tmId = (tm.teamId || tm._id) as string;
                              const tmName = tm.teamName as string;
                              return (
                                <SelectItem key={tmId} value={tmId}>
                                  {tmName}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
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
                <Button type="submit" disabled={create.pending || isProjectReadOnly} className="gap-2">
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
