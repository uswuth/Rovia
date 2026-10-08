import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { z } from 'zod';
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
import { Skeleton } from '@/components/ui/skeleton';
import { createTeamApi, updateTeamApi } from '@/api/teams/teams.api';
import { parseApiError } from '@/utils/apiError';
import { useProjects } from '@/hooks/useProjects';
import { useTeams } from '@/hooks/useTeams';
import { getProjectId } from '@/types/project.types';
import { MemberRoster } from '@/components/members/MemberRoster';
import type { Member } from '@/types/member.types';

const TITLE_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9 _-]*[a-zA-Z0-9])?$/;

const teamFormSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(2, 'Team name must be at least 2 characters')
    .regex(TITLE_REGEX, 'Team name can only contain letters, numbers, spaces, -, _'),
  projectId: z.string().min(1, 'Parent project is required'),
  description: z.string().trim().optional(),
  teamStatus: z.enum(['active', 'completed', 'archived']),
});

type TeamFormValues = z.infer<typeof teamFormSchema>;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const CreateTeam: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const { projects: rawProjects, loading: projectsLoading } = useProjects();
  const { teams: rawTeams, loading: teamsLoading } = useTeams();

  const projects = useMemo<Record<string, unknown>[]>(
    () => rawProjects as unknown as Record<string, unknown>[],
    [rawProjects]
  );

  const [, setExistingTeam] = useState<Record<string, unknown> | null>(null);
  const [assignedRoles, setAssignedRoles] = useState<Record<string, 'Host' | 'Member'>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string>('');

  const loading = projectsLoading || teamsLoading;

  const { register, handleSubmit, reset, watch, control, formState: { errors } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      teamName: '',
      projectId: '',
      description: '',
      teamStatus: 'active',
    },
  });

  const selectedProjectId = watch('projectId');

  useEffect(() => {
    if (loading) return;

    if (id) {
      const found = rawTeams.find(
        (t: Record<string, unknown>) => (t.teamId || t._id) === id
      );
      if (found) {
        setExistingTeam(found);
        const pObj =
          typeof found.projectId === 'object' && found.projectId !== null
            ? (found.projectId as unknown as Record<string, unknown>)
            : null;
        const pId = pObj ? ((pObj._id || pObj.projectId) as string) : (found.projectId as string);

        reset({
          teamName: (found.teamName as string) || '',
          projectId: pId || '',
          description: (found.description as string) || '',
          teamStatus: (found.teamStatus as 'active' | 'completed' | 'archived') || 'active',
        });

        const rolesMap: Record<string, 'Host' | 'Member'> = {};
        const hostsArr = (found.hosts as unknown[]) || [];
        const membersArr = (found.members as unknown[]) || [];

        hostsArr.forEach((h) => {
          const hId = typeof h === 'object' && h !== null ? (((h as unknown as Record<string, unknown>)._id || (h as unknown as Record<string, unknown>).userId) as string) : (h as string);
          if (hId) rolesMap[hId] = 'Host';
        });
        membersArr.forEach((m) => {
          const mId = typeof m === 'object' && m !== null ? (((m as unknown as Record<string, unknown>)._id || (m as unknown as Record<string, unknown>).userId) as string) : (m as string);
          if (mId && !rolesMap[mId]) rolesMap[mId] = 'Member';
        });

        setAssignedRoles(rolesMap);
      }
    } else if (rawProjects.length > 0) {
      const defaultPId = getProjectId(rawProjects[0]);
      reset({
        teamName: '',
        projectId: defaultPId || '',
        description: '',
        teamStatus: 'active',
      });
    }
  }, [id, loading, rawProjects, rawTeams, reset]);

  // Compute member pool from selected parent project
  const projectMemberPool = useMemo<Member[]>(() => {
    if (!selectedProjectId) return [];
    const pObj = projects.find((p) => (p.projectId || p._id) === selectedProjectId);
    if (!pObj) return [];

    const hosts = (pObj.hosts as unknown[]) || [];
    const members = (pObj.members as unknown[]) || [];
    const map = new Map<string, Member>();

    [...hosts, ...members].forEach((item) => {
      if (!item) return;
      const itemObj = item as unknown as Record<string, unknown>;
      const memberId =
        typeof item === 'object' && item !== null
          ? ((itemObj.userId || itemObj._id) as string)
          : (item as string);

      if (memberId && !map.has(memberId)) {
        const name = typeof item === 'object' && item !== null ? ((itemObj.userName || itemObj.userEmail) as string) : memberId;
        const email = typeof item === 'object' && item !== null ? (itemObj.userEmail as string) || '' : '';
        const rawRole = typeof item === 'object' && item !== null ? (itemObj.userRole as string) || 'Member' : 'Member';

        const role = (rawRole.toUpperCase() === 'ADMIN' ? 'Admin' : rawRole.toUpperCase() === 'SUPERADMIN' ? 'SuperAdmin' : 'Member') as Member['userRole'];

        map.set(memberId, {
          userId: memberId,
          userName: name || memberId,
          userEmail: email,
          userRole: role,
          userStatus: 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
      }
    });

    return Array.from(map.values());
  }, [selectedProjectId, projects]);

  const onSubmit = async (values: TeamFormValues) => {
    setServerError('');
    setSubmitting(true);

    try {
      const hostIds = Object.entries(assignedRoles)
        .filter(([, role]) => role === 'Host')
        .map(([mId]) => mId);
      const memberIds = Object.entries(assignedRoles)
        .filter(([, role]) => role === 'Member')
        .map(([mId]) => mId);

      const payload = {
        teamName: values.teamName.trim(),
        description: values.description?.trim(),
        projectId: values.projectId,
        hosts: hostIds,
        members: memberIds,
        teamStatus: values.teamStatus,
      };

      if (isEditMode && id) {
        await updateTeamApi(id, payload);
      } else {
        await createTeamApi(payload);
      }
      navigate('/teams');
    } catch (err) {
      const { message } = parseApiError(err);
      setServerError(message || 'Failed to save team.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="w-full space-y-6">
        {/* Top Header Row with Title and Inline Back Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
              <Users size={24} className="text-emerald-500" />
              <span>{isEditMode ? 'Edit Team' : 'Create New Team'}</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? 'Update sub-team parameters, status, and assigned team members.'
                : 'Configure sub-team details and assign team members from the parent project.'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/teams')}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back to Teams</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* LEFT COLUMN: Team Details Form Fields */}
            <div className="lg:col-span-7 space-y-5">
              <FormField label="Team Name" htmlFor="team-name" required error={errors.teamName?.message}>
                <Input id="team-name" {...register('teamName')} placeholder="e.g. Frontend Engineering" />
              </FormField>

              <FormField label="Parent Project" htmlFor="parent-project" required error={errors.projectId?.message}>
                <Controller
                  control={control}
                  name="projectId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        if (val) {
                          field.onChange(val);
                          setAssignedRoles({});
                        }
                      }}
                    >
                      <SelectTrigger id="parent-project" className="w-full sm:w-72">
                        <SelectValue placeholder="Select Parent Project">
                          {(val: unknown) => {
                            if (!val) return 'Select Parent Project';
                            const match = projects.find((p) => (p.projectId || p._id || p.id) === val);
                            return match ? ((match.projectName || match.name || match.title) as string) : String(val);
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.length === 0 ? (
                          <SelectItem value="" disabled>
                            No projects available
                          </SelectItem>
                        ) : (
                          projects.map((p) => {
                            const pId = (p.projectId || p._id || p.id) as string;
                            const pName = (p.projectName || p.name || p.title) as string || 'Unnamed Project';
                            return (
                              <SelectItem key={pId} value={pId}>
                                {pName}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label="Status" htmlFor="team-status" required error={errors.teamStatus?.message}>
                <Controller
                  control={control}
                  name="teamStatus"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        if (val) field.onChange(val);
                      }}
                    >
                      <SelectTrigger id="team-status" className="w-48 sm:w-56">
                        <SelectValue placeholder="Select status">
                          {(val: unknown) => {
                            if (!val) return 'Select status';
                            const opt = STATUS_OPTIONS.find((s) => s.value === val);
                            return opt ? opt.label : String(val);
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>

              <FormField label="Description" htmlFor="team-description" error={errors.description?.message}>
                <Textarea id="team-description" rows={3} placeholder="Describe the team's primary scope and responsibilities..." {...register('description')} />
              </FormField>

              {serverError && (
                <p role="alert" className="text-xs text-destructive font-medium">
                  {serverError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/teams')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  <Users size={15} />
                  <span>{submitting ? (isEditMode ? 'Saving…' : 'Creating…') : isEditMode ? 'Update Team' : 'Create Team'}</span>
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Team Member Role Assignment using MemberRoster */}
            <div className="lg:col-span-5">
              <MemberRoster
                members={projectMemberPool}
                value={assignedRoles}
                onChange={setAssignedRoles}
                title="Team Members & Roles"
                entityName="team"
                lockSuperAdmin={true}
                maxHosts={3}
                searchPlaceholder="Search project members..."
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTeam;
