import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { useDebounce } from '@/hooks/useDebounce';
import { getAllOrganizationsServerAdminApi } from '@/api/server-admin/server-admin.api';
import {
  getServerOrgColumns,
  type ServerOrg
} from './ServerAdminOrg.TanCol';

export const ServerAdminOrganizations: React.FC = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<ServerOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    let isMounted = true;
    getAllOrganizationsServerAdminApi()
      .then((res) => {
        if (isMounted) {
          setOrganizations(res.data.data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load organizations', err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleView = useCallback(
    (orgId: string) => {
      navigate(`/server-admin/organizations/${orgId}`);
    },
    [navigate]
  );

  const filteredOrgs = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter((o) => {
      const name = (o.organizationName || '').toLowerCase();
      const slug = (o.organizationSlug || '').toLowerCase();
      const loc = (o.organizationLocation || '').toLowerCase();
      return name.includes(q) || slug.includes(q) || loc.includes(q);
    });
  }, [organizations, debouncedSearch]);

  const columns = useMemo(
    () =>
      getServerOrgColumns({
        onView: handleView,
      }),
    [handleView]
  );

  return (
    <div className="w-full space-y-6">
      {/* Header with Search and Create Org Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Client Organizations</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage provisioned client tenant organizations, codes, and metadata.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search organizations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8.5 text-xs bg-card"
            />
          </div>

          <Button
            onClick={() => navigate('/server-admin/organizations/new')}
            className="h-8.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-sm shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Create Organization</span>
          </Button>
        </div>
      </div>

      {/* Empty State or DataTable */}
      {!loading && organizations.length === 0 ? (
        <div className="rounded-sm border border-border/80 bg-card p-12 text-center space-y-4 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <Building2 size={24} />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">No client organizations provisioned</h3>
            <p className="text-xs text-muted-foreground">
              Get started by provisioning the first client tenant organization on this cluster.
            </p>
          </div>
          <Button
            onClick={() => navigate('/server-admin/organizations/new')}
            className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-sm shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Create Organization</span>
          </Button>
        </div>
      ) : (
        <div className="rounded-sm border border-border/80 bg-card overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredOrgs}
            loading={loading}
            keyExtractor={(row) => row.organizationId}
            onRowClick={(row) => handleView(row.organizationId)}
            emptyMessage={
              <div className="p-8 text-center text-xs text-muted-foreground">
                No organizations matching &quot;{search}&quot;
              </div>
            }
          />
        </div>
      )}
    </div>
  );
};
