import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import {
  provisionUserApi,
  updateUserApi,
  getAllUsersAdminApi,
} from '@/api/organization/organization.api';
import { getWorkRolesApi } from '@/api/work-roles/work-roles.api';
import { getJobTitles } from '@/api/job-title/job-title.api';
import { parseApiError } from '@/utils/apiError';
import { extractApiItems } from '@/utils/apiResponse';

const memberFormSchema = z.object({
  userName: z.string().trim().min(2, 'Member name must be at least 2 characters'),
  userEmail: z.string().trim().email('Valid email address is required'),
  password: z.string().optional(),
  userRole: z.enum(['Admin', 'Member']),
  userStatus: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']),
  jobTitle: z.string().trim().optional(),
});

type MemberFormValues = z.infer<typeof memberFormSchema>;

const ROLE_OPTIONS = [
  { value: 'Member', label: 'Member' },
  { value: 'Admin', label: 'Admin' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Deactivated' },
];

const generateRandomPassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

export const CreateOrgMember: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');

  const [jobTitleOptions, setJobTitleOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Derive organization ID
  const organizationId = typeof user?.organizationId === 'object'
    ? ((user.organizationId as unknown as Record<string, unknown>)?._id as string) || ((user.organizationId as unknown as Record<string, unknown>)?.organizationId as string) || ''
    : user?.organizationId || '';

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      userName: '',
      userEmail: '',
      password: '',
      userRole: 'Member',
      userStatus: 'ACTIVE',
      jobTitle: '',
    },
  });

  useEffect(() => {
    let isMounted = true;
    const loadJobTitles = async () => {
      try {
        const [wrRes, jtRes] = await Promise.allSettled([getWorkRolesApi(), getJobTitles()]);
        if (!isMounted) return;

        const titlesSet = new Set<string>();

        if (wrRes.status === 'fulfilled') {
          extractApiItems<Record<string, string>>(wrRes.value).forEach((r) => {
            if (r.roleName) titlesSet.add(r.roleName);
          });
        }

        if (jtRes.status === 'fulfilled') {
          extractApiItems<Record<string, string>>(jtRes.value).forEach((j) => {
            if (j.title) titlesSet.add(j.title);
          });
        }

        setJobTitleOptions(Array.from(titlesSet));
      } catch (err) {
        console.error(err);
      }
    };

    void loadJobTitles();

    if (id && isAdmin) {
      const loadUser = async () => {
        try {
          setLoading(true);
          const res = await getAllUsersAdminApi();
          if (!isMounted) return;

          const usersList = extractApiItems<Record<string, string>>(res);
          const found = usersList.find((u) => u.userId === id || u._id === id);

          if (found) {
            reset({
              userName: found.userName || '',
              userEmail: found.userEmail || '',
              password: '',
              userRole: found.userRole === 'Admin' ? 'Admin' : 'Member',
              userStatus: (found.userStatus as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED') || 'ACTIVE',
              jobTitle: found.jobTitle || '',
            });
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (isMounted) setLoading(false);
        }
      };
      void loadUser();
    }

    return () => {
      isMounted = false;
    };
  }, [id, isAdmin, reset]);

  const handleAutoGeneratePassword = () => {
    const generated = generateRandomPassword();
    setValue('password', generated);
  };

  const onSubmit = async (values: MemberFormValues) => {
    setServerError('');
    setSubmitting(true);

    try {
      if (isEditMode && id) {
        await updateUserApi(id, {
          userName: values.userName.trim(),
          userEmail: values.userEmail.trim(),
          userRole: values.userRole,
          userStatus: values.userStatus,
          jobTitle: values.jobTitle?.trim() || undefined,
          organizationId: organizationId || undefined,
        });
      } else {
        await provisionUserApi({
          userName: values.userName.trim(),
          userEmail: values.userEmail.trim(),
          password: values.password?.trim() || undefined,
          organizationId: organizationId || '',
          userRole: values.userRole,
          userStatus: values.userStatus,
          jobTitle: values.jobTitle?.trim() || undefined,
        });
      }
      navigate('/organization/members');
    } catch (err) {
      const { message } = parseApiError(err);
      setServerError(message || 'Failed to save member.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
              <UserPlus size={24} className="text-emerald-500" />
              <span>{isEditMode ? 'Edit Member' : 'Add Member'}</span>
            </h1>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/organization/members')}
            className="gap-1.5 self-start sm:self-auto cursor-pointer border-border hover:bg-muted"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <FormField label="Full Name" htmlFor="user-name" required error={errors.userName?.message}>
            <Input id="user-name" {...register('userName')} />
          </FormField>

          <FormField label="Email Address" htmlFor="user-email" required error={errors.userEmail?.message}>
            <Input id="user-email" type="email" {...register('userEmail')} />
          </FormField>

          {!isEditMode && (
            <FormField label="Password" htmlFor="user-password" error={errors.password?.message}>
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <PasswordInput
                    id="user-password"
                    value={field.value || ''}
                    onChange={field.onChange}
                    onGeneratePassword={handleAutoGeneratePassword}
                  />
                )}
              />
            </FormField>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Role" htmlFor="user-role" required error={errors.userRole?.message}>
              <Controller
                control={control}
                name="userRole"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }}
                  >
                    <SelectTrigger id="user-role" className="w-full">
                      <SelectValue placeholder="Select Role">
                        {(val: unknown) => {
                          if (!val) return 'Select Role';
                          const opt = ROLE_OPTIONS.find((r) => r.value === val);
                          return opt ? opt.label : String(val);
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Status" htmlFor="user-status" required error={errors.userStatus?.message}>
              <Controller
                control={control}
                name="userStatus"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }}
                  >
                    <SelectTrigger id="user-status" className="w-full">
                      <SelectValue placeholder="Select Status">
                        {(val: unknown) => {
                          if (!val) return 'Select Status';
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
          </div>

          <FormField label="Job Title" htmlFor="job-title" error={errors.jobTitle?.message}>
            {jobTitleOptions.length > 0 ? (
              <Controller
                control={control}
                name="jobTitle"
                render={({ field }) => (
                  <Select
                    value={field.value || 'NONE'}
                    onValueChange={(val) => {
                      field.onChange(val === 'NONE' ? '' : val);
                    }}
                  >
                    <SelectTrigger id="job-title" className="w-full">
                      <SelectValue placeholder="Select Job Title">
                        {(val: unknown) => (val && val !== 'NONE' ? String(val) : 'Select Job Title')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select Job Title</SelectItem>
                      {jobTitleOptions.map((title) => (
                        <SelectItem key={title} value={title}>
                          {title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            ) : (
              <Input id="job-title" {...register('jobTitle')} />
            )}
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
              onClick={() => navigate('/organization/members')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="gap-2">
              <UserPlus size={15} />
              <span>{submitting ? (isEditMode ? 'Saving…' : 'Adding…') : isEditMode ? 'Update' : 'Add'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrgMember;
