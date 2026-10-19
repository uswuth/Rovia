import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  ArrowLeft,
  Edit2,
  Trash2,
  MapPin,
  FileText,
  Calendar,
  Users,
  FolderGit2,
  CheckSquare,
  Video,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  getOrgDetailsServerAdminApi,
  updateOrgServerAdminApi,
  deleteOrgServerAdminApi
} from '@/api/server-admin/server-admin.api';

export interface ServerOrgOwner {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userCode?: string;
  userStatus?: string;
}

export interface ServerOrgDetails {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationLocation?: string;
  organizationDescription?: string;
  ownerId?: ServerOrgOwner | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrgDetailsData {
  organization: ServerOrgDetails;
  metrics: {
    memberCount: number;
    projectCount: number;
    teamCount: number;
    meetingCount: number;
    taskCount: number;
  };
}

export const ServerAdminOrgView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<OrgDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    organizationName: '',
    organizationLocation: '',
    organizationDescription: ''
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchDetails = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getOrgDetailsServerAdminApi(id);
      const fetched = res.data.data as OrgDetailsData;
      setData(fetched);

      const org = fetched.organization;
      setEditForm({
        organizationName: org.organizationName || '',
        organizationLocation: org.organizationLocation || '',
        organizationDescription: org.organizationDescription || ''
      });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj?.response?.data?.message || 'Failed to load organization details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    getOrgDetailsServerAdminApi(id)
      .then((res) => {
        if (!isMounted) return;
        const fetched = res.data.data as OrgDetailsData;
        setData(fetched);
        const org = fetched.organization;
        setEditForm({
          organizationName: org.organizationName || '',
          organizationLocation: org.organizationLocation || '',
          organizationDescription: org.organizationDescription || ''
        });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const errorObj = err as { response?: { data?: { message?: string } } };
        setError(errorObj?.response?.data?.message || 'Failed to load organization details.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSavingEdit(true);
      await updateOrgServerAdminApi(id, editForm);
      setIsEditOpen(false);
      await fetchDetails();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to update organization.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await deleteOrgServerAdminApi(id);
      navigate('/server-admin/organizations', { replace: true });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to delete organization.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[300px] flex items-center justify-center text-muted-foreground text-xs gap-2">
        <Loader2 size={16} className="animate-spin text-emerald-500" />
        <span>Loading organization details...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-xs text-destructive">{error || 'Organization not found.'}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/server-admin/organizations')}
          className="text-xs"
        >
          Back to Organizations
        </Button>
      </div>
    );
  }

  const org = data.organization;
  const orgName = org.organizationName || 'Organization';
  const orgSlug = org.organizationSlug || id;
  const orgLoc = org.organizationLocation || '—';
  const orgDesc = org.organizationDescription || 'No description provided.';
  const createdAt = org.createdAt;
  const owner = typeof org.ownerId === 'object' && org.ownerId !== null ? org.ownerId : null;
  const ownerName = owner?.userName || 'Organization Super Admin';
  const ownerEmail = owner?.userEmail || '—';

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/server-admin/organizations')}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {orgName}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                Active Tenant
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Code: {orgSlug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="text-xs gap-1.5 cursor-pointer"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDeleteOpen(true)}
            className="text-xs gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="rounded-sm border border-border/80 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
            <Users size={12} className="text-emerald-500" />
            <span>Members</span>
          </div>
          <p className="text-xl font-extrabold text-foreground">{data.metrics.memberCount}</p>
        </div>

        <div className="rounded-sm border border-border/80 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
            <FolderGit2 size={12} className="text-blue-500" />
            <span>Projects</span>
          </div>
          <p className="text-xl font-extrabold text-foreground">{data.metrics.projectCount}</p>
        </div>

        <div className="rounded-sm border border-border/80 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
            <Users size={12} className="text-indigo-500" />
            <span>Teams</span>
          </div>
          <p className="text-xl font-extrabold text-foreground">{data.metrics.teamCount}</p>
        </div>

        <div className="rounded-sm border border-border/80 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
            <Video size={12} className="text-purple-500" />
            <span>Meetings</span>
          </div>
          <p className="text-xl font-extrabold text-foreground">{data.metrics.meetingCount}</p>
        </div>

        <div className="rounded-sm border border-border/80 bg-card p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase">
            <CheckSquare size={12} className="text-amber-500" />
            <span>Tasks</span>
          </div>
          <p className="text-xl font-extrabold text-foreground">{data.metrics.taskCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-sm border border-border/80 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Building2 size={14} className="text-emerald-500" />
            <span>Organization Profile</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Organization Name</span>
              <span className="font-semibold text-foreground text-sm">{orgName}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Organization Code / Slug</span>
              <span className="font-mono font-bold text-foreground">{orgSlug}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <MapPin size={13} className="text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Location / Address</span>
                <span className="text-foreground">{orgLoc}</span>
              </div>
            </div>

            <div className="flex items-start gap-1.5">
              <FileText size={13} className="text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Description</span>
                <span className="text-foreground">{orgDesc}</span>
              </div>
            </div>

            {createdAt && (
              <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                <Calendar size={13} className="text-muted-foreground shrink-0" />
                <span className="text-muted-foreground text-[11px]">
                  Created: {new Date(createdAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-sm border border-border/80 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Primary Client SuperAdmin</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Full Name</span>
              <span className="font-semibold text-foreground text-sm">{ownerName}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Email Address</span>
              <span className="font-mono text-foreground">{ownerEmail}</span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Account Role</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                SuperAdmin
              </span>
            </div>
          </div>
        </div>
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-border rounded-sm max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-emerald-500" />
                <h3 className="text-sm font-bold text-foreground">Edit Organization</h3>
              </div>
              <button
                onClick={() => setIsEditOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Organization Name *</label>
                <Input
                  type="text"
                  required
                  value={editForm.organizationName}
                  onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Address / Location</label>
                <Input
                  type="text"
                  value={editForm.organizationLocation}
                  onChange={(e) => setEditForm({ ...editForm, organizationLocation: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground">Description</label>
                <Textarea
                  rows={2}
                  value={editForm.organizationDescription}
                  onChange={(e) => setEditForm({ ...editForm, organizationDescription: e.target.value })}
                  className="text-xs resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingEdit}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                >
                  {savingEdit ? <RefreshCw size={13} className="animate-spin" /> : null}
                  <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-card border border-destructive/40 rounded-sm max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center gap-2.5 text-destructive">
              <AlertTriangle size={20} />
              <h3 className="text-sm font-bold text-foreground">Permanently Delete Organization</h3>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                This action is irreversible. All users, projects, teams, meetings, and tasks under{' '}
                <strong className="text-foreground">{orgName}</strong> will be permanently purged from the database.
              </p>
              <p className="text-[11px]">
                Please type <span className="font-mono font-bold text-foreground select-all">{orgName}</span> to confirm.
              </p>
              <Input
                type="text"
                placeholder={orgName}
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={deleting}
                onClick={() => {
                  setIsDeleteOpen(false);
                  setConfirmName('');
                }}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={confirmName !== orgName || deleting}
                size="sm"
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 text-white text-xs gap-1.5 cursor-pointer font-semibold"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{deleting ? 'Purging Organization...' : 'Delete Permanently'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
