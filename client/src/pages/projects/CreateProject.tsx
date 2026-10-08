import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FolderGit2 } from 'lucide-react';
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
import { useMutation, useQuery } from '@/hooks/useApi';
import { queryKeys } from '@/api/queryClient';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useProject } from '@/context/ProjectContext';
import { createProject, updateProject, getProjectById } from '@/api/project/project.api';
import { parseApiError } from '@/utils/apiError';
import { MemberRoster } from '@/components/members/MemberRoster';
import { getRoleCategory, getMemberId } from '@/components/members/member-utils';
import type { Project, CreateProjectDTO } from '@/types/project.types';

const TITLE_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9 _-]*[a-zA-Z0-9])?$/;

const projectFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Project name must be at least 2 characters')
    .regex(TITLE_REGEX, 'Project name can only contain letters, numbers, spaces, -, _, and cannot start or end with a symbol'),
  description: z.string().trim().optional(),
  status: z.enum(['active', 'completed', 'archived']),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const CreateProject: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { members: orgMembers } = useOrganization();
  const { addProject } = useProject();

  // Fetch existing project if in edit mode
  const { data: existingProject, loading: projectLoading } = useQuery<Project>(
    queryKeys.projects.detail(id || ''),
    () => getProjectById(id || ''),
    { enabled: isAuthenticated && isEditMode && Boolean(id) }
  );

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
    },
  });

  const watchedName = useWatch({ control, name: 'name' });
  const projectName = watchedName || existingProject?.projectName || existingProject?.name;

  // Default roster: SuperAdmins are always Hosts, plus any hosts/members already
  // saved on the project being edited.
  const defaultRoles = useMemo<Record<string, 'Host' | 'Member'>>(() => {
    const roleMap: Record<string, 'Host' | 'Member'> = {};

    orgMembers?.forEach((m) => {
      const cat = getRoleCategory(m);
      if (cat === 'SUPER_ADMIN' || cat === 'ADMIN') {
        const mId = getMemberId(m);
        if (mId) roleMap[mId] = 'Host';
      }
    });

    if (existingProject) {
      const toId = (entry: string | { _id?: string; id?: string; userId?: string }): string | undefined =>
        typeof entry === 'string' ? entry : entry._id || entry.id || entry.userId;
      (existingProject.hosts || []).forEach((h) => {
        const hId = toId(h);
        if (hId) roleMap[hId] = 'Host';
      });
      (existingProject.members || []).forEach((m) => {
        const mId = toId(m);
        if (mId && !roleMap[mId]) roleMap[mId] = 'Member';
      });
    }

    return roleMap;
  }, [orgMembers, existingProject]);

  // Reseed the editable roster whenever the defaults change, instead of syncing
  // it in an effect.
  const [seededRoles, setSeededRoles] = useState(defaultRoles);
  const [assignedRoles, setAssignedRoles] = useState(defaultRoles);
  if (seededRoles !== defaultRoles) {
    setSeededRoles(defaultRoles);
    setAssignedRoles(defaultRoles);
  }

  // Populate the form fields in edit mode once the project is fetched
  useEffect(() => {
    if (!isEditMode || !existingProject) return;
    reset({
      name: existingProject.projectName || existingProject.name || '',
      description: existingProject.projectDescription || existingProject.description || '',
      status: (existingProject.projectStatus || existingProject.status || 'active').toLowerCase() as ProjectFormValues['status'],
    });
  }, [isEditMode, existingProject, reset]);

  const saveMutation = useMutation<Project, ProjectFormValues>({
    invalidates: [queryKeys.projects.all],
    mutationFn: (values) => {
      const hostIds = Object.entries(assignedRoles)
        .filter(([, role]) => role === 'Host')
        .map(([mId]) => mId);
      const memberIds = Object.entries(assignedRoles)
        .filter(([, role]) => role === 'Member')
        .map(([mId]) => mId);

      const dto: CreateProjectDTO = {
        name: values.name.trim(),
        projectName: values.name.trim(),
        description: values.description?.trim(),
        projectDescription: values.description?.trim(),
        status: values.status,
        projectStatus: values.status,
        hosts: hostIds,
        members: memberIds,
      };

      if (isEditMode && id) {
        return updateProject(id, dto);
      }
      return createProject(dto);
    },
    onSuccess: (savedProject) => {
      if (savedProject) {
        addProject(savedProject);
      }
      navigate('/projects');
    },
  });

  if (isEditMode && projectLoading) {
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
              <FolderGit2 size={24} className="text-emerald-500" />
              <span>{isEditMode ? 'Edit Project' : 'Create New Project'}</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {isEditMode
                ? 'Update project parameters, status, and project-specific member roles.'
                : 'Configure workspace project details and assign team members with project-specific roles.'}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/projects')}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back to Projects</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* LEFT COLUMN: Project Details Form Fields */}
            <div className="lg:col-span-7 space-y-5">
              <FormField label="Project Name" htmlFor="project-name" required error={errors.name?.message}>
                <Input id="project-name" {...register('name')} />
              </FormField>

              <FormField label="Status" htmlFor="project-status" required error={errors.status?.message}>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val) => {
                        if (val) field.onChange(val);
                      }}
                    >
                      <SelectTrigger id="project-status" className="w-48 sm:w-56">
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

              <FormField label="Description" htmlFor="project-description" error={errors.description?.message}>
                <Textarea id="project-description" rows={3} {...register('description')} />
              </FormField>

              {Boolean(saveMutation.error) && (
                <p role="alert" className="text-xs text-destructive font-medium">
                  {parseApiError(saveMutation.error).message}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate('/projects')}
                  disabled={saveMutation.pending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.pending} className="gap-2">
                  <FolderGit2 size={15} />
                  <span>{saveMutation.pending ? (isEditMode ? 'Saving…' : 'Creating…') : isEditMode ? 'Update Project' : 'Create Project'}</span>
                </Button>
              </div>
            </div>

            {/* RIGHT COLUMN: Project Member Role Assignment */}
            <div className="lg:col-span-5">
              <MemberRoster
                members={orgMembers ?? []}
                value={assignedRoles}
                onChange={setAssignedRoles}
                title="Project Members & Roles"
                entityName="project"
                projectName={projectName || 'this project'}
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

export default CreateProject;
