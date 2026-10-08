import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  createOrganizationApi,
  getAllOrganizationsApi,
  provisionUserApi,
  updateUserApi,
  getAllUsersAdminApi
} from '@/api/organization/organization.api';
import type {
  AdminOrganization,
  AdminProvisionedUser
} from '@/api/organization/organization.types';
import {
  Building2,
  UserPlus,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Search,
  RefreshCw,
  Users,
  AlertCircle,
  Sparkles,
  Edit2,
  X,
  Activity
} from 'lucide-react';

export default function AdminOrgManager() {
  const { user } = useAuth();
  const hasServerAdminToken = Boolean(localStorage.getItem('server_admin_token'));
  const isSuperAdmin = Boolean(hasServerAdminToken || user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const isOrgAdmin = Boolean(isSuperAdmin || user?.userRole === 'Admin');

  // Derive Super Admin's / Org Admin's default Organization ID
  const superAdminOrgId = typeof user?.organizationId === 'object'
    ? ((user.organizationId as unknown as Record<string, unknown>)?._id as string) || ((user.organizationId as unknown as Record<string, unknown>)?.organizationId as string) || ''
    : user?.organizationId || '';

  // Active tab state: 'organizations' | 'users'
  const [activeTab, setActiveTab] = useState<'organizations' | 'users'>(isSuperAdmin ? 'organizations' : 'users');

  // Organizations Data & State
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgForm, setOrgForm] = useState({
    organizationName: '',
    organizationLocation: '',
    organizationDescription: ''
  });
  const [submittingOrg, setSubmittingOrg] = useState(false);

  // Users Data & State
  const [usersList, setUsersList] = useState<AdminProvisionedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL');

  // Provisioning Form state with default Organization ID
  const [userForm, setUserForm] = useState({
    userName: '',
    userEmail: '',
    password: '',
    organizationId: superAdminOrgId,
    userRole: 'Member' as 'SuperAdmin' | 'Admin' | 'Member',
    userStatus: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',
    jobTitle: ''
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // Edit User Modal state
  const [editingUser, setEditingUser] = useState<AdminProvisionedUser | null>(null);
  const [editForm, setEditForm] = useState({
    userName: '',
    userEmail: '',
    userRole: 'Member' as 'SuperAdmin' | 'Admin' | 'Member',
    userStatus: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',
    jobTitle: '',
    organizationId: ''
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Feedback notifications & copy states
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch initial data
  const loadOrgs = async () => {
    try {
      setLoadingOrgs(true);
      const res = await getAllOrganizationsApi();
      setOrganizations(res.data.data || []);
    } catch (err: unknown) {
      console.error('Failed to load organizations', err);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await getAllUsersAdminApi();
      setUsersList(res.data.data || []);
    } catch (err: unknown) {
      console.error('Failed to load users', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      void (async () => {
        await loadOrgs();
        await loadUsers();
      })();
    }
  }, [isSuperAdmin]);

  // Handle Org Submission
  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgForm.organizationName.trim()) {
      setMessage({ type: 'error', text: 'Organization name is required.' });
      return;
    }

    try {
      setSubmittingOrg(true);
      setMessage(null);
      const res = await createOrganizationApi(orgForm);
      setMessage({
        type: 'success',
        text: `Organization "${res.data.data.organizationName}" created successfully!`
      });
      setOrgForm({ organizationName: '', organizationLocation: '', organizationDescription: '' });
      await loadOrgs();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const errMsg = errorObj?.response?.data?.message || 'Failed to create organization.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSubmittingOrg(false);
    }
  };

  // Handle User Provisioning
  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.userName.trim() || !userForm.userEmail.trim()) {
      setMessage({ type: 'error', text: 'Name and Email are required.' });
      return;
    }
    if (!userForm.organizationId && !superAdminOrgId) {
      setMessage({ type: 'error', text: 'Please select an Organization.' });
      return;
    }

    try {
      setSubmittingUser(true);
      setMessage(null);
      const res = await provisionUserApi({
        ...userForm,
        organizationId: userForm.organizationId || superAdminOrgId
      });
      const createdUser = res.data.data;
      setMessage({
        type: 'success',
        text: `User "${createdUser.userName}" provisioned with status [${createdUser.userStatus || 'ACTIVE'}]. Initial password: ${createdUser.initialPassword}`
      });
      setUserForm({
        userName: '',
        userEmail: '',
        password: '',
        organizationId: superAdminOrgId,
        userRole: 'Member',
        userStatus: 'ACTIVE',
        jobTitle: ''
      });
      await loadUsers();
      await loadOrgs();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const errMsg = errorObj?.response?.data?.message || 'Failed to provision user.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSubmittingUser(false);
    }
  };

  // Open Edit User Modal
  const openEditModal = (u: AdminProvisionedUser) => {
    const orgId = typeof u.organization_id === 'object'
      ? u.organization_id?._id
      : (u.organization_id || u.organizationId || '');

    setEditingUser(u);
    setEditForm({
      userName: u.userName,
      userEmail: u.userEmail,
      userRole: u.userRole || 'Member',
      userStatus: u.userStatus || 'ACTIVE',
      jobTitle: u.jobTitle || '',
      organizationId: typeof orgId === 'string' ? orgId : ''
    });
  };

  // Handle Update User Submission
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      setSubmittingEdit(true);
      setMessage(null);
      await updateUserApi(editingUser.userId, editForm);
      setMessage({
        type: 'success',
        text: `User "${editForm.userName}" updated successfully!`
      });
      setEditingUser(null);
      await loadUsers();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const errMsg = errorObj?.response?.data?.message || 'Failed to update user.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Copy code helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (!isOrgAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <div className="p-4 bg-red-500/10 text-red-500 rounded-full mb-4">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Only Organization Admin or Super Admin accounts are authorized to manage Organizations and IAM User Provisioning.
        </p>
      </div>
    );
  }

  // Filtered lists
  const filteredOrgs = organizations.filter((o) =>
    o.organizationName.toLowerCase().includes(orgSearch.toLowerCase()) ||
    o.organizationSlug.toLowerCase().includes(orgSearch.toLowerCase()) ||
    (o.organizationLocation && o.organizationLocation.toLowerCase().includes(orgSearch.toLowerCase()))
  );

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      u.userName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.userEmail.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.userCode && u.userCode.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(userSearch.toLowerCase()));

    const orgId = typeof u.organization_id === 'object' ? u.organization_id?._id : u.organization_id || u.organizationId;
    const matchesOrg = selectedOrgFilter === 'ALL' || orgId === selectedOrgFilter;

    return matchesSearch && matchesOrg;
  });

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Top Banner Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-blue-400/30">
              <ShieldCheck className="w-4 h-4" /> {isSuperAdmin ? 'Super Admin Master Control Console' : 'Organization IAM Console'}
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {isSuperAdmin ? 'Platform & Organization Management' : 'Team IAM & User Provisioning'}
            </h1>
            <p className="mt-1 text-blue-200/80 text-sm max-w-2xl">
              {isSuperAdmin
                ? 'Create self-hosted multi-tenant Organizations, provision client accounts, and manage system users.'
                : 'Provision and manage user accounts exclusively for your platform organization.'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10">
            {isSuperAdmin && (
              <div className="text-center px-3 border-r border-white/20">
                <p className="text-xs text-blue-200">Organizations</p>
                <p className="text-2xl font-bold">{organizations.length}</p>
              </div>
            )}
            <div className="text-center px-3">
              <p className="text-xs text-blue-200">Total Users</p>
              <p className="text-2xl font-bold">{usersList.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Notification */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-sm shadow-md transition-all ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <Check className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center space-x-2 border-b border-gray-200 dark:border-gray-800">
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('organizations')}
            className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'organizations'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Organizations ({organizations.length})
          </button>
        )}

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          IAM Users Table ({usersList.length})
        </button>
      </div>

      {/* TAB 1: ORGANIZATIONS MANAGER */}
      {activeTab === 'organizations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Org Form */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Organization</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Add a new organization to the system</p>
              </div>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corporation"
                  value={orgForm.organizationName}
                  onChange={(e) => setOrgForm({ ...orgForm, organizationName: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Location / Region
                </label>
                <input
                  type="text"
                  placeholder="e.g. New York, USA"
                  value={orgForm.organizationLocation}
                  onChange={(e) => setOrgForm({ ...orgForm, organizationLocation: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Short summary of organization..."
                  value={orgForm.organizationDescription}
                  onChange={(e) => setOrgForm({ ...orgForm, organizationDescription: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingOrg}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingOrg ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {submittingOrg ? 'Creating Org...' : 'Create Organization'}
              </button>
            </form>
          </div>

          {/* Organizations Table */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">All Organizations</h2>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search orgs..."
                    value={orgSearch}
                    onChange={(e) => setOrgSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white w-48"
                  />
                </div>
                <button
                  onClick={loadOrgs}
                  className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 rounded-xl"
                  title="Refresh Orgs"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingOrgs ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 flex-1">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Slug</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Members</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredOrgs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-400">
                        {loadingOrgs ? 'Loading organizations...' : 'No organizations found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrgs.map((org) => (
                      <tr key={org.organizationId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-3 font-semibold text-gray-900 dark:text-white">
                          {org.organizationName}
                          {org.organizationDescription && (
                            <p className="text-[11px] font-normal text-gray-400 line-clamp-1">
                              {org.organizationDescription}
                            </p>
                          )}
                        </td>
                        <td className="p-3 font-mono text-gray-500">{org.organizationSlug}</td>
                        <td className="p-3 text-gray-500">{org.organizationLocation || 'N/A'}</td>
                        <td className="p-3 font-semibold text-gray-900 dark:text-white">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">
                            <Users className="w-3 h-3 text-gray-400" /> {org.memberCount ?? 0}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IAM USER PROVISIONING & ALL USERS TABLE */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Provision User Form */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Provision New User</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">Defaults to Super Admin Organization</p>
              </div>
            </div>

            <form onSubmit={handleProvisionUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target Organization *
                </label>
                <select
                  required
                  value={userForm.organizationId}
                  onChange={(e) => setUserForm({ ...userForm, organizationId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                >
                  <option value="">Select an Organization</option>
                  {organizations.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.organizationName} {org.organizationId === superAdminOrgId ? '(Default Org)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  User Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jane Doe"
                  value={userForm.userName}
                  onChange={(e) => setUserForm({ ...userForm, userName: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  User Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="jane.doe@organization.com"
                  value={userForm.userEmail}
                  onChange={(e) => setUserForm({ ...userForm, userEmail: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Initial Password (Optional, default: User@123456)
                </label>
                <input
                  type="password"
                  placeholder="Set initial password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    System Role
                  </label>
                  <select
                    value={userForm.userRole}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        userRole: e.target.value as 'SuperAdmin' | 'Admin' | 'Member'
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="SuperAdmin">SuperAdmin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    User Status
                  </label>
                  <select
                    value={userForm.userStatus}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        userStatus: e.target.value as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="DEACTIVATED">DEACTIVATED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Engineer"
                  value={userForm.jobTitle}
                  onChange={(e) => setUserForm({ ...userForm, jobTitle: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={submittingUser}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingUser ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {submittingUser ? 'Provisioning User...' : 'Provision User'}
              </button>
            </form>
          </div>

          {/* Users Table */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">All Users Table</h2>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <select
                  value={selectedOrgFilter}
                  onChange={(e) => setSelectedOrgFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                >
                  <option value="ALL">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.organizationName}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white w-40"
                  />
                </div>

                <button
                  onClick={loadUsers}
                  className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 rounded-xl"
                  title="Refresh Users"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 flex-1">
              <table className="w-full text-left text-xs text-gray-600 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-800/60 uppercase font-semibold text-gray-500 dark:text-gray-400">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400">
                        {loadingUsers ? 'Loading users...' : 'No users found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const orgObj = typeof u.organization_id === 'object' ? u.organization_id : null;
                      const orgName = orgObj?.organization_name || 'No Organization';
                      const currentStatus = u.userStatus || 'ACTIVE';

                      return (
                        <tr key={u.userId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="p-3">
                            <p className="font-semibold text-gray-900 dark:text-white">{u.userName}</p>
                            <p className="text-[11px] text-gray-400">{u.userEmail}</p>
                          </td>
                          <td className="p-3 font-medium text-gray-700 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800">
                              <Building2 className="w-3.5 h-3.5 text-blue-500" />
                              {orgName}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                u.userRole === 'SuperAdmin' || u.isSuperAdmin
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                  : u.userRole === 'Admin'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                  : 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'
                              }`}
                            >
                              <Key className="w-3 h-3" />
                              {u.userRole || 'Member'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                currentStatus === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : currentStatus === 'SUSPENDED'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                              }`}
                            >
                              <Activity className="w-3 h-3" />
                              {currentStatus}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => openEditModal(u)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                              title="Edit user details and status"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-0">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit User Profile</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.userName}
                  onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editForm.userEmail}
                  onChange={(e) => setEditForm({ ...editForm, userEmail: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    System Role
                  </label>
                  <select
                    value={editForm.userRole}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        userRole: e.target.value as 'SuperAdmin' | 'Admin' | 'Member'
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  >
                    <option value="Member">Member</option>
                    <option value="Admin">Admin</option>
                    <option value="SuperAdmin">SuperAdmin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={editForm.userStatus}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        userStatus: e.target.value as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="DEACTIVATED">DEACTIVATED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Job Title
                </label>
                <input
                  type="text"
                  value={editForm.jobTitle}
                  onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Organization
                </label>
                <select
                  value={editForm.organizationId}
                  onChange={(e) => setEditForm({ ...editForm, organizationId: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                >
                  <option value="">Select Organization</option>
                  {organizations.map((org) => (
                    <option key={org.organizationId} value={org.organizationId}>
                      {org.organizationName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
