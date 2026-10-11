import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, RefreshCw, UserPlus } from 'lucide-react';
import { getOrganizationMembers } from '@/api/organization/organization.api';
import { useAuth } from '@/context/AuthContext';
import { extractApiItems } from '@/utils/apiResponse';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { useDebounce } from '@/hooks/useDebounce';
import type { Member } from '@/types/member.types';
import { getOrgMemberColumns } from './Org.TanCol';

export const OrgMembers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const canManage = isSuperAdmin || user?.userRole === 'Admin';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await getOrganizationMembers();
      setMembers(extractApiItems<Member>(res));
    } catch (err) {
      console.error(err);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await loadMembers();
    })();
  }, []);

  const filteredMembers = useMemo(() => {
    if (!debouncedSearch.trim()) return members;
    const query = debouncedSearch.toLowerCase();
    return members.filter((m) =>
      (m.userName || '').toLowerCase().includes(query) ||
      (m.userEmail || '').toLowerCase().includes(query) ||
      (m.userCode || '').toLowerCase().includes(query) ||
      (m.jobTitle || '').toLowerCase().includes(query)
    );
  }, [members, debouncedSearch]);

  const columns = useMemo(
    () => getOrgMemberColumns({ navigate, canManage, currentUser: user }),
    [navigate, canManage, user]
  );

  return (
    <div className="w-full max-w-full min-w-0 bg-background text-foreground p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Users className="text-emerald-500 dark:text-emerald-400" size={24} />
            <span>Organization Members</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Complete member roster, personal contact details, and platform access roles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 h-9 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={loadMembers}
            className="h-9 px-3 gap-1.5 cursor-pointer"
            title="Refresh Members"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
          {canManage && (
            <Button
              onClick={() => navigate('/organization/members/new')}
              className="h-9 shadow-xs shrink-0 gap-2 cursor-pointer"
            >
              <UserPlus size={15} />
              <span>Add</span>
            </Button>
          )}
        </div>
      </div>

      {/* Members DataTable */}
      <DataTable
        columns={columns}
        data={filteredMembers}
        loading={loading}
        loadingRowCount={5}
        keyExtractor={(m) => m.userId || m.userCode || ''}
        paginate={true}
        pageSize={10}
        pageSizeOptions={[5, 10, 25, 50]}
      />
    </div>
  );
};

export default OrgMembers;
