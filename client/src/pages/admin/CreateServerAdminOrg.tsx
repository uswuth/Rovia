import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Building2,
  ArrowLeft,
  Sparkles,
  Key,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  User,
  Mail,
  MapPin,
  FileText,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  createServerAdminOrgSchema,
  type CreateServerAdminOrgFormValues
} from '@/schemas/server-admin.schema';
import { createOrgWithCredentialsApi } from '@/api/server-admin/server-admin.api';
import { decryptCredential } from '@/utils/crypto';

interface GeneratedCreds {
  organization: {
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    location?: string;
  };
  credentials: {
    adminUserId: string;
    adminName: string;
    adminEmail: string;
    encryptedPassword?: string;
    initialPassword?: string;
    userRole: string;
  };
}

export const CreateServerAdminOrg: React.FC = () => {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [generatedCreds, setGeneratedCreds] = useState<GeneratedCreds | null>(null);
  const [decryptedPassword, setDecryptedPassword] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<CreateServerAdminOrgFormValues>({
    resolver: zodResolver(createServerAdminOrgSchema),
    defaultValues: {
      organizationName: '',
      organizationLocation: '',
      organizationDescription: '',
      adminName: '',
      adminEmail: ''
    }
  });

  const onSubmit = async (data: CreateServerAdminOrgFormValues) => {
    setServerError(null);
    try {
      const res = await createOrgWithCredentialsApi({
        organizationName: data.organizationName,
        organizationLocation: data.organizationLocation || undefined,
        organizationDescription: data.organizationDescription || undefined,
        adminName: data.adminName,
        adminEmail: data.adminEmail
      });

      const rawCreds = res.data.data as GeneratedCreds;
      let clearPassword = '';
      if (rawCreds.credentials?.encryptedPassword) {
        clearPassword = await decryptCredential(rawCreds.credentials.encryptedPassword);
      } else if (rawCreds.credentials?.initialPassword) {
        clearPassword = rawCreds.credentials.initialPassword;
      }

      setDecryptedPassword(clearPassword);
      setGeneratedCreds(rawCreds);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setServerError(errorObj?.response?.data?.message || 'Failed to create organization.');
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      {/* Back button & Page Title */}
      <div className="flex items-center gap-3 pb-2 border-b border-border/40">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/server-admin/organizations')}
          className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Create Client Organization</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Provision a new tenant organization and initialize its primary SuperAdmin identity.
          </p>
        </div>
      </div>

      {serverError && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-sm flex items-center gap-2.5 text-xs text-destructive">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-medium">{serverError}</span>
        </div>
      )}

      {/* Form Container Card */}
      <div className="rounded-sm border border-border/80 bg-card p-6 shadow-xs">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Organization Details Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Building2 size={14} className="text-emerald-500" />
              <span>Organization Information</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-foreground">Organization Name *</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="e.g. Acme Tech Solutions"
                    className="pl-9 h-10 text-xs bg-background"
                    {...register('organizationName')}
                  />
                </div>
                {errors.organizationName && (
                  <p className="text-[11px] text-destructive font-medium">{errors.organizationName.message}</p>
                )}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-foreground">Address / Region / Location</label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="e.g. Sulur, Coimbatore"
                    className="pl-9 h-10 text-xs bg-background"
                    {...register('organizationLocation')}
                  />
                </div>
                {errors.organizationLocation && (
                  <p className="text-[11px] text-destructive font-medium">{errors.organizationLocation.message}</p>
                )}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-foreground">Organization Description</label>
                <div className="relative">
                  <FileText size={15} className="absolute left-3 top-3 text-muted-foreground pointer-events-none" />
                  <Textarea
                    rows={3}
                    placeholder="Brief description of the organization and operations"
                    className="pl-9 text-xs bg-background resize-none"
                    {...register('organizationDescription')}
                  />
                </div>
                {errors.organizationDescription && (
                  <p className="text-[11px] text-destructive font-medium">{errors.organizationDescription.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Super Admin Primary Identity Section */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 pb-2 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <User size={14} className="text-emerald-500" />
              <span>Initial Client SuperAdmin Account</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">SuperAdmin Full Name *</label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="e.g. Arlo Admin"
                    className="pl-9 h-10 text-xs bg-background"
                    {...register('adminName')}
                  />
                </div>
                {errors.adminName && (
                  <p className="text-[11px] text-destructive font-medium">{errors.adminName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">SuperAdmin Email Address *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    type="email"
                    placeholder="e.g. admin@arlotech.com"
                    className="pl-9 h-10 text-xs bg-background"
                    {...register('adminEmail')}
                  />
                </div>
                {errors.adminEmail && (
                  <p className="text-[11px] text-destructive font-medium">{errors.adminEmail.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/server-admin/organizations')}
              className="text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-5 shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Provisioning Organization...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Create Organization</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Generated Credentials Popup Modal */}
      {generatedCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-sm max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Key size={18} />
                <h3 className="text-sm font-bold text-foreground">Organization Provisioned</h3>
              </div>
              <button
                onClick={() => {
                  setGeneratedCreds(null);
                  navigate('/server-admin/organizations');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/40 rounded-sm space-y-1.5 border border-border">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Organization:</span>
                  <span className="font-bold text-foreground">{generatedCreds.organization.organizationName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Org Code:</span>
                  <span className="font-mono font-bold text-foreground">{generatedCreds.organization.organizationSlug}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">SuperAdmin Email</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      readOnly
                      value={generatedCreds.credentials.adminEmail}
                      className="h-9 text-xs bg-muted/50 font-mono select-all"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 cursor-pointer"
                      onClick={() => copyToClipboard(generatedCreds.credentials.adminEmail, 'email')}
                      title="Copy Email"
                    >
                      {copiedKey === 'email' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">Generated Initial Password</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="password"
                      readOnly
                      value={decryptedPassword || '••••••••••••'}
                      className="h-9 text-xs bg-muted/50 font-mono select-all tracking-wider"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 cursor-pointer"
                      onClick={() => copyToClipboard(decryptedPassword, 'pass')}
                      title="Copy Password"
                    >
                      {copiedKey === 'pass' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                onClick={() => {
                  setGeneratedCreds(null);
                  navigate('/server-admin/organizations');
                }}
                className="h-8.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-sm cursor-pointer"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
