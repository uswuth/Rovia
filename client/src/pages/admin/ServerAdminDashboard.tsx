import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Activity,
  Cpu,
  Radio,
  Plus,
  Copy,
  Check,
  Trash2,
  Edit2,
  RefreshCw,
  LogOut,
  Sparkles,
  Users,
  Search,
  Key
} from 'lucide-react';
import {
  getServerMetricsApi,
  getAllOrganizationsServerAdminApi,
  createOrgWithCredentialsApi,
  updateOrgServerAdminApi,
  deleteOrgServerAdminApi
} from '@/api/server-admin/server-admin.api';

export function ServerAdminDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [organizations, setOrganizations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Org Creation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    organizationName: '',
    organizationLocation: '',
    organizationDescription: '',
    adminName: '',
    adminEmail: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<Record<string, unknown> | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Edit Org state
  const [editingOrg, setEditingOrg] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({
    organizationName: '',
    organizationLocation: '',
    organizationDescription: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [mRes, oRes] = await Promise.all([
        getServerMetricsApi(),
        getAllOrganizationsServerAdminApi()
      ]);
      setMetrics(mRes.data.data.metrics);
      setOrganizations(oRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('server_admin_token');
    if (!token) {
      navigate('/server-admin/login');
      return;
    }
    void (async () => {
      await loadData();
    })();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('server_admin_token');
    localStorage.removeItem('server_admin_user');
    navigate('/server-admin/login');
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.organizationName.trim() || !createForm.adminEmail.trim()) return;

    try {
      setSubmitting(true);
      const res = await createOrgWithCredentialsApi(createForm);
      setGeneratedCreds(res.data.data);
      setCreateForm({
        organizationName: '',
        organizationLocation: '',
        organizationDescription: '',
        adminName: '',
        adminEmail: ''
      });
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to create organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;
    try {
      const targetId = (editingOrg.organizationId || editingOrg._id) as string;
      await updateOrgServerAdminApi(targetId, editForm);
      setEditingOrg(null);
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to update organization.');
    }
  };

  const handleDeleteOrg = async (orgId: string) => {
    if (!confirm('Are you sure you want to delete this Organization and all its associated users?')) return;
    try {
      await deleteOrgServerAdminApi(orgId);
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      alert(errorObj?.response?.data?.message || 'Failed to delete organization.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredOrgs = organizations.filter(
    (o) =>
      ((o.organizationName as string) || '').toLowerCase().includes(search.toLowerCase()) ||
      ((o.organizationSlug as string) || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Server Admin Master Control</h1>
            <p className="text-xs text-muted-foreground">Self-Hosted Platform Operator & Telemetry Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/server-admin/organizations')}
            className="px-3.5 py-2.5 bg-secondary text-secondary-foreground font-semibold text-xs rounded-xl hover:bg-secondary/80 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-emerald-500" /> Org Console & IAM
          </button>
          <button
            onClick={loadData}
            className="p-2.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-xl transition-all cursor-pointer"
            title="Refresh Telemetry Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Provision New Client Org
          </button>
          <button
            onClick={handleLogout}
            className="p-2.5 bg-destructive/10 text-destructive hover:bg-destructive/20 rounded-xl transition-all"
            title="Logout Server Admin"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Telemetry Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Prometheus Metrics</span>
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
          </div>
          <p className="text-xl font-extrabold">{(metrics?.prometheusStatus as string) || 'HEALTHY'}</p>
          <p className="text-[11px] text-muted-foreground">Scraping metrics at /metrics</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Grafana Dashboard</span>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <p className="text-xl font-extrabold">{(metrics?.grafanaStatus as string) || 'ACTIVE'}</p>
          <p className="text-[11px] text-muted-foreground">Latency: {(metrics?.apiLatencyMs as number) || 24} ms avg</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Organizations</span>
            <Building2 className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-extrabold">{organizations.length}</p>
          <p className="text-[11px] text-muted-foreground">Self-hosted platform tenants</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">System Heap Usage</span>
            <Cpu className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-extrabold">{(metrics?.systemMemoryMB as number) || 64} MB</p>
          <p className="text-[11px] text-muted-foreground">Node.js process memory</p>
        </div>
      </div>

      {/* Generated Credentials Alert */}
      {generatedCreds && (() => {
        const genOrg = generatedCreds.organization as Record<string, unknown> | undefined;
        const genCreds = generatedCreds.credentials as Record<string, unknown> | undefined;
        const genPassword = (genCreds?.initialPassword as string) || '';

        return (
          <div className="bg-card border-2 border-emerald-500/40 rounded-2xl p-6 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <Key className="w-5 h-5" /> Client Organization & Credentials Provisioned Successfully!
              </div>
              <button
                onClick={() => setGeneratedCreds(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Close Alert
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-background border border-border p-4 rounded-xl text-xs">
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Organization Details</p>
                <p>Name: <span className="font-bold text-foreground">{(genOrg?.organizationName as string) || ''}</span></p>
                <p>Slug: <span className="font-mono">{(genOrg?.organizationSlug as string) || ''}</span></p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground mb-1">Generated Client SuperAdmin Credentials</p>
                <p>Email: <span className="font-bold text-foreground">{(genCreds?.adminEmail as string) || ''}</span></p>
                <div className="flex items-center gap-2 mt-1">
                  <span>Initial Password:</span>
                  <code className="bg-secondary px-2 py-0.5 rounded font-mono font-bold text-primary">
                    {genPassword}
                  </code>
                  <button
                    onClick={() => copyToClipboard(genPassword)}
                    className="p-1 hover:bg-secondary rounded text-muted-foreground"
                    title="Copy password"
                  >
                    {copiedText === genPassword ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Hand over these credentials to the client. They can log into the platform at <code className="text-primary font-bold">/login</code>.
            </p>
          </div>
        );
      })()}

      {/* Organizations Table */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Platform Client Organizations</h2>
            <p className="text-xs text-muted-foreground">Verify, update, or remove client tenant organizations</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs text-muted-foreground">
            <thead className="bg-secondary/50 uppercase font-semibold text-foreground">
              <tr>
                <th className="p-3">Organization Name</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Location</th>
                <th className="p-3">Members</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
                    No client organizations found.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => {
                  const orgIdStr = (org.organizationId || org._id) as string;
                  const orgNameStr = (org.organizationName as string) || '';
                  const orgDescStr = (org.organizationDescription as string) || '';
                  const orgSlugStr = (org.organizationSlug as string) || '';
                  const orgLocStr = (org.organizationLocation as string) || 'N/A';
                  const memberCountNum = (org.memberCount as number) ?? 0;

                  return (
                    <tr key={orgIdStr} className="hover:bg-secondary/30 transition-colors">
                      <td className="p-3 font-semibold text-foreground">
                        {orgNameStr}
                        {Boolean(orgDescStr) && (
                          <p className="text-[11px] text-muted-foreground font-normal line-clamp-1">
                            {orgDescStr}
                          </p>
                        )}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{orgSlugStr}</td>
                      <td className="p-3">{orgLocStr}</td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-foreground font-bold">
                          <Users className="w-3 h-3 text-muted-foreground" /> {memberCountNum}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setEditingOrg(org);
                            setEditForm({
                              organizationName: orgNameStr,
                              organizationLocation: orgLocStr === 'N/A' ? '' : orgLocStr,
                              organizationDescription: orgDescStr
                            });
                          }}
                          className="p-1.5 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
                          title="Edit Organization"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteOrg(orgIdStr)}
                          className="p-1.5 hover:bg-destructive/10 rounded-lg text-destructive"
                          title="Delete Organization"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Provision New Client Org Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" /> Provision Client Organization
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Enterprise Corp"
                  value={createForm.organizationName}
                  onChange={(e) => setCreateForm({ ...createForm, organizationName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Region / Location</label>
                <input
                  type="text"
                  placeholder="New York, USA"
                  value={createForm.organizationLocation}
                  onChange={(e) => setCreateForm({ ...createForm, organizationLocation: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Client Org SuperAdmin Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm({ ...createForm, adminName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Client Org SuperAdmin Email *</label>
                <input
                  type="email"
                  required
                  placeholder="admin@acme.com"
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 flex items-center gap-2"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {submitting ? 'Provisioning...' : 'Provision & Generate Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Org Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold">Edit Organization</h3>
              <button onClick={() => setEditingOrg(null)} className="text-muted-foreground hover:text-foreground text-xs">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateOrg} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Organization Name</label>
                <input
                  type="text"
                  required
                  value={editForm.organizationName}
                  onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Location</label>
                <input
                  type="text"
                  value={editForm.organizationLocation}
                  onChange={(e) => setEditForm({ ...editForm, organizationLocation: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingOrg(null)}
                  className="px-4 py-2 text-xs font-medium bg-secondary rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-xl"
                >
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
