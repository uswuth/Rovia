import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckSquare } from 'lucide-react';
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
import { getTaskByIdApi, createTaskApi, updateTaskApi, type TaskStatusType } from '@/api/tasks/tasks.api';
import { getTeamsApi } from '@/api/teams/teams.api';
import { parseApiError } from '@/utils/apiError';
import { extractApiItems } from '@/utils/apiResponse';
import { MemberRoster } from '@/components/members/MemberRoster';
import { useOrganization } from '@/context/OrganizationContext';
import { useProject } from '@/context/ProjectContext';
import { getRoleCategory, getMemberId, isTopAdminRole } from '@/components/members/member-utils';
import type { Member } from '@/types/member.types';

const taskFormSchema = z.object({
  taskTitle: z.string().trim().min(2, 'Task title must be at least 2 characters'),
  projectId: z.string().min(1, 'Parent project is required'),
  teamId: z.string().optional(),
  taskDescription: z.string().trim().optional(),
  taskStatus: z.enum(['to_do', 'in_progress', 'bug', 'backlog', 'completed']),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const STATUS_OPTIONS: { value: TaskStatusType; label: string }[] = [
  { value: 'to_do', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'bug', label: 'Bug / Issue' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'completed', label: 'Completed' },
];

export const CreateTask: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const { members: orgMembers } = useOrganization();
  const { projects: contextProjects } = useProject();
  const hasFetchedRef = useRef(false);

  const [teams, setTeams] = useState<Record<string, unknown>[]>([]);
  const [assignedRoles, setAssignedRoles] = useState<Record<string, 'Host' | 'Member'>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string>('');

  const projects = useMemo(() => {
    return (contextProjects || []) as unknown as Record<string, unknown>[];
  }, [contextProjects]);

  const { register, handleSubmit, reset, watch, control, formState: { errors } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      taskTitle: '',
      projectId: '',
      teamId: '',
      taskDescription: '',
      taskStatus: 'to_do',
    },
  });

  const selectedProjectId = watch('projectId');
  const selectedTeamId = watch('teamId');

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    let isMounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const promises: [Promise<unknown>, Promise<unknown>?] = [
          getTeamsApi(),
        ];
        if (id) {
          promises.push(getTaskByIdApi(id));
        }
        const [tmRes, tkRes] = await Promise.all(promises);
        if (!isMounted) return;

        const rawTeams = extractApiItems(tmRes);
        setTeams(rawTeams as unknown as Record<string, unknown>[]);

        if (id && tkRes) {
          const rawTaskData = (tkRes as { data?: { data?: Record<string, unknown> } }).data?.data || (tkRes as Record<string, unknown>);
          const found = (rawTaskData.items ? rawTaskData.items[0] : rawTaskData) as Record<string, unknown>;

          if (found) {
            const pObj =
              typeof found.projectId === 'object' && found.projectId !== null
                ? (found.projectId as unknown as Record<string, unknown>)
                : null;
            const pId = pObj ? ((pObj._id || pObj.projectId) as string) : (found.projectId as string);

            const tmObj =
              typeof found.teamId === 'object' && found.teamId !== null
                ? (found.teamId as unknown as Record<string, unknown>)
                : null;
            const tmId = tmObj ? ((tmObj._id || tmObj.teamId) as string) : (found.teamId as string);

            reset({
              taskTitle: (found.taskTitle as string) || (found.task_title as string) || '',
              projectId: pId || '',
              teamId: tmId || '',
              taskDescription: (found.taskDescription as string) || (found.task_description as string) || '',
              taskStatus: (found.taskStatus as TaskStatusType) || (found.task_status as TaskStatusType) || 'to_do',
            });

            const rolesMap: Record<string, 'Host' | 'Member'> = {};
            const assignedArr = (found.assignedMembers as unknown[]) || (found.assigned_members as unknown[]) || [];
            assignedArr.forEach((m) => {
              const mId = typeof m === 'object' && m !== null ? (((m as unknown as Record<string, unknown>)._id || (m as unknown as Record<string, unknown>).userId) as string) : (m as string);
              if (mId) rolesMap[mId] = 'Member';
            });
            setAssignedRoles(rolesMap);
          }
        } else if (projects.length > 0) {
          const defaultPId = (projects[0].projectId || projects[0]._id) as string;
          reset({
            taskTitle: '',
            projectId: defaultPId || '',
            teamId: '',
            taskDescription: '',
            taskStatus: 'to_do',
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [id, reset]);

  // Compute member candidate pool from selected team or project while preserving org roles
  const candidateMemberPool = useMemo<Member[]>(() => {
    const map = new Map<string, Member>();

    const getRealMember = (mId: string, emailStr?: string, itemObj?: Record<string, unknown>): Member => {
      const match = orgMembers?.find((om) => {
        const omId = om.userId || (om as { _id?: string })._id;
        return omId === mId || Boolean(emailStr && om.userEmail?.toLowerCase() === emailStr.toLowerCase());
      });
      if (match) return match;

      const name = itemObj ? ((itemObj.userName || itemObj.userEmail) as string) : mId;
      const roleStr = (itemObj ? (itemObj.userRole as string) || 'Member' : 'Member') as import('@/types/member.types').MemberRole;
      const isSuper = itemObj ? Boolean(itemObj.isSuperAdmin) : false;

      return {
        userId: mId,
        userName: name || mId,
        userEmail: emailStr || '',
        userRole: roleStr,
        isSuperAdmin: isSuper,
        userStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
    };

    if (selectedTeamId) {
      const tObj = teams.find((t) => (t.teamId || t._id) === selectedTeamId);
      if (tObj) {
        const hosts = (tObj.hosts as unknown[]) || [];
        const members = (tObj.members as unknown[]) || [];
        [...hosts, ...members].forEach((item) => {
          if (!item) return;
          const itemObj = item as unknown as Record<string, unknown>;
          const mId = typeof item === 'object' && item !== null ? ((itemObj.userId || itemObj._id) as string) : (item as string);
          const email = typeof item === 'object' && item !== null ? (itemObj.userEmail as string) || '' : '';
          if (mId && !map.has(mId)) {
            map.set(mId, getRealMember(mId, email, typeof item === 'object' ? itemObj : undefined));
          }
        });
      }
    } else if (selectedProjectId) {
      const pObj = projects.find((p) => (p.projectId || p._id) === selectedProjectId);
      if (pObj) {
        const hosts = (pObj.hosts as unknown[]) || [];
        const members = (pObj.members as unknown[]) || [];
        [...hosts, ...members].forEach((item) => {
          if (!item) return;
          const itemObj = item as unknown as Record<string, unknown>;
          const mId = typeof item === 'object' && item !== null ? ((itemObj.userId || itemObj._id) as string) : (item as string);
          const email = typeof item === 'object' && item !== null ? (itemObj.userEmail as string) || '' : '';
          if (mId && !map.has(mId)) {
            map.set(mId, getRealMember(mId, email, typeof item === 'object' ? itemObj : undefined));
          }
        });
      }
    }

    // Always include Super Admin and Admin from organization members
    if (orgMembers && orgMembers.length > 0) {
      orgMembers.forEach((om) => {
        const cat = getRoleCategory(om);
        if (cat === 'SUPER_ADMIN' || cat === 'ADMIN') {
          const mId = getMemberId(om);
          if (mId && !map.has(mId)) {
            map.set(mId, om);
          }
        }
      });
    }

    // Fallback if pool is empty
    if (map.size === 0 && orgMembers) {
      orgMembers.forEach((om) => {
        const mId = getMemberId(om);
        if (mId) map.set(mId, om);
      });
    }

    return Array.from(map.values());
  }, [selectedProjectId, selectedTeamId, projects, teams, orgMembers]);

  // Lock top admins as Host when candidate pool changes
  useEffect(() => {
    if (candidateMemberPool.length === 0) return;
    const topAdmins = candidateMemberPool.filter(isTopAdminRole);
    let updated = false;
    const copy = { ...assignedRoles };
    topAdmins.forEach((m) => {
      const mId = getMemberId(m);
      if (mId && copy[mId] !== 'Host') {
        copy[mId] = 'Host';
        updated = true;
      }
    });
    if (updated) {
      setAssignedRoles(copy);
    }
  }, [candidateMemberPool]);

  const onSubmit = async (values: TaskFormValues) => {
    setServerError('');
    setSubmitting(true);

    try {
      const assignedIds = Object.keys(assignedRoles);

      const payload = {
        taskTitle: values.taskTitle.trim(),
        taskDescription: values.taskDescription?.trim(),
        projectId: values.projectId,
        teamId: values.teamId || undefined,
        taskStatus: values.taskStatus,
        assignedMembers: assignedIds,
      };

      if (isEditMode && id) {
        await updateTaskApi(id, payload);
      } else {
        await createTaskApi(payload);
      }
      navigate('/tasks');
    } catch (err) {
      const { message } = parseApiError(err);
      setServerError(message || 'Failed to save task.');
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
              <CheckSquare size={24} className="text-emerald-500" />
              <span>{isEditMode ? 'Edit Task' : 'Create New Task'}</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? 'Update task parameters, status, and assigned members.'
                : 'Configure task details and assign work to project or team members.'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/tasks')}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back to Tasks</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* LEFT COLUMN: Task Details Form Fields */}
            <div className="lg:col-span-7 space-y-5">
              <FormField label="Task Title" htmlFor="task-title" required error={errors.taskTitle?.message}>
                <Input id="task-title" {...register('taskTitle')} placeholder="e.g. Implement OAuth JWT Refresh Endpoint" />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            reset((prev) => ({ ...prev, teamId: '' }));
                            setAssignedRoles({});
                          }
                        }}
                      >
                        <SelectTrigger id="parent-project">
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

                <FormField label="Assigned Team (Optional)" htmlFor="assigned-team" error={errors.teamId?.message}>
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
                        <SelectTrigger id="assigned-team">
                          <SelectValue placeholder="No Specific Team">
                            {(val: unknown) => {
                              if (!val || val === 'NONE') return 'No Specific Team';
                              const match = teams.find((t) => (t.teamId || t._id) === val);
                              return match ? (match.teamName as string) : String(val);
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">No Specific Team</SelectItem>
                          {teams
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

              <FormField label="Status" htmlFor="task-status" required error={errors.taskStatus?.message}>
                <Controller
                  control={control}
                  name="taskStatus"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        if (val) field.onChange(val);
                      }}
                    >
                      <SelectTrigger id="task-status" className="w-48 sm:w-56">
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

              <FormField label="Description" htmlFor="task-description" error={errors.taskDescription?.message}>
                <Textarea id="task-description" rows={4} placeholder="Detailed requirements, technical acceptance criteria, and edge cases..." {...register('taskDescription')} />
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
                  onClick={() => navigate('/tasks')}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="gap-2">
                  <CheckSquare size={15} />
                  <span>{submitting ? (isEditMode ? 'Saving…' : 'Creating…') : isEditMode ? 'Update Task' : 'Create Task'}</span>
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Task Assignees Selection using MemberRoster */}
            <div className="lg:col-span-5">
              <MemberRoster
                members={candidateMemberPool}
                value={assignedRoles}
                onChange={setAssignedRoles}
                title="Task Assignees"
                entityName="task"
                lockSuperAdmin={true}
                searchPlaceholder="Search candidates..."
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTask;
