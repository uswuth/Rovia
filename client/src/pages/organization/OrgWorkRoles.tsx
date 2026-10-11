import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Briefcase, Plus, RefreshCw } from 'lucide-react';
import {
  getWorkRolesApi,
  createWorkRoleApi,
  updateWorkRoleApi,
  deleteWorkRoleApi,
  type WorkRoleItem,
} from '@/api/work-roles/work-roles.api';
import { useAuth } from '@/context/AuthContext';
import { extractApiItems } from '@/utils/apiResponse';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { DataTable } from '@/components/ui/data-table';
import { parseApiError } from '@/utils/apiError';
import { getWorkRoleColumns } from './WorkRoles.TanCol';

export const OrgWorkRoles: React.FC = () => {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const canManage = isSuperAdmin || user?.userRole === 'Admin';

  const [roles, setRoles] = useState<WorkRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<WorkRoleItem | null>(null);
  const [form, setForm] = useState({ roleName: '', tagName: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const loadRoles = async () => {
    try {
      setLoading(true);
      const res = await getWorkRolesApi();
      setRoles(extractApiItems<WorkRoleItem>(res));
    } catch (err) {
      console.error(err);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadRoles();
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!form.roleName.trim()) return;

    try {
      setSubmitting(true);
      const userOrgId =
        typeof user?.organizationId === 'object' && user?.organizationId !== null
          ? (user.organizationId as { organizationId?: string; _id?: string }).organizationId ||
          (user.organizationId as { organizationId?: string; _id?: string })._id
          : (user?.organizationId as string | undefined);

      if (editingRole) {
        const targetId = (editingRole.roleId || (editingRole as unknown as { _id?: string })._id) as string;
        await updateWorkRoleApi(targetId, form);
      } else {
        await createWorkRoleApi({
          ...form,
          ...(userOrgId ? { organizationId: userOrgId } : {}),
        });
      }
      setIsModalOpen(false);
      setEditingRole(null);
      setForm({ roleName: '', tagName: '', description: '' });
      await loadRoles();
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      setServerError(message || 'Failed to save work role.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = useCallback(async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this work role?')) return;
    try {
      await deleteWorkRoleApi(roleId);
      await loadRoles();
    } catch (err: unknown) {
      const { message } = parseApiError(err);
      alert(message || 'Failed to delete work role.');
    }
  }, []);

  const handleEdit = useCallback((role: WorkRoleItem) => {
    setEditingRole(role);
    setForm({
      roleName: role.roleName || '',
      tagName: role.tagName || '',
      description: role.description || '',
    });
    setIsModalOpen(true);
  }, []);

  const filteredRoles = roles.filter(
    (r) =>
      (r.roleName || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.roleCode && r.roleCode.toLowerCase().includes(search.toLowerCase())) ||
      (r.tagName && r.tagName.toLowerCase().includes(search.toLowerCase()))
  );

  const columns = useMemo(
    () =>
      getWorkRoleColumns({
        canManage,
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
    [canManage, handleEdit, handleDelete]
  );

  return (
    <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Briefcase className="text-emerald-500 dark:text-emerald-400" size={24} />
            <span>Organization Work Roles</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage custom job positions and role categories (e.g. Intern, Senior SDE, Tech Lead).
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Input
            type="text"
            placeholder="Search work roles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 h-9 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadRoles}
            className="h-9 px-3 gap-1.5 cursor-pointer"
            title="Refresh Work Roles"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          {canManage && (
            <Button
              onClick={() => {
                setEditingRole(null);
                setForm({ roleName: '', tagName: '', description: '' });
                setIsModalOpen(true);
              }}
              className="h-9 shadow-xs shrink-0 gap-2 cursor-pointer"
            >
              <Plus size={15} />
              <span>Create Work Role</span>
            </Button>
          )}
        </div>
      </div>

      {/* Work Roles DataTable */}
      <DataTable
        columns={columns}
        data={filteredRoles}
        loading={loading}
        loadingRowCount={4}
        keyExtractor={(r) => (r.roleId || r.roleCode) as string}
      />

      {/* Create / Edit Work Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Briefcase size={18} className="text-emerald-500" />
                <span>{editingRole ? 'Edit Work Role' : 'Create Work Role'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Role Name" htmlFor="role-name" required>
                <Input
                  id="role-name"
                  type="text"
                  required
                  placeholder="e.g. Senior SDE, Technical Lead"
                  value={form.roleName}
                  onChange={(e) => setForm({ ...form, roleName: e.target.value })}
                />
              </FormField>

              <FormField label="Tag / Category" htmlFor="role-tag">
                <Input
                  id="role-tag"
                  type="text"
                  placeholder="e.g. Engineering, Product, Marketing"
                  value={form.tagName}
                  onChange={(e) => setForm({ ...form, tagName: e.target.value })}
                />
              </FormField>

              <FormField label="Description" htmlFor="role-desc">
                <Textarea
                  id="role-desc"
                  rows={3}
                  placeholder="Role scope and key expectations..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FormField>

              {serverError && (
                <p role="alert" className="text-xs text-destructive font-medium">
                  {serverError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={submitting} className="gap-2">
                  <span>{submitting ? 'Saving…' : editingRole ? 'Update Role' : 'Create Role'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrgWorkRoles;
