import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, RefreshCw, Phone, MapPin, Droplet, UserPlus, Edit2 } from 'lucide-react';
import { getOrganizationMembers } from '@/api/organization/organization.api';
import { useAuth } from '@/context/AuthContext';
import { extractApiItems } from '@/utils/apiResponse';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getRoleBadgeTone } from '@/lib/status-tone';
import type { Member } from '@/types/member.types';

export const OrgMembers: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.userRole === 'SuperAdmin' || user?.isSuperAdmin);
  const canManage = isSuperAdmin || user?.userRole === 'Admin';

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filteredMembers = members.filter((m) => {
    const query = search.toLowerCase();
    return (
      (m.userName || '').toLowerCase().includes(query) ||
      (m.userEmail || '').toLowerCase().includes(query) ||
      (m.userCode || '').toLowerCase().includes(query) ||
      (m.jobTitle || '').toLowerCase().includes(query)
    );
  });

  const columns: Column<Member>[] = [
    {
      id: 'code',
      header: 'User Code',
      width: '110px',
      cell: (m) => (
        <span className="font-mono text-xs font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-sm">
          {m.userCode || 'USR-N/A'}
        </span>
      ),
    },
    {
      id: 'name',
      header: 'Member Name & Email',
      width: '220px',
      cell: (m) => {
        const name = m.userName || 'Unnamed';
        const email = m.userEmail || '';
        const userCode = m.userCode || '';
        const memberId = m.userId || '';
        const profilePath = userCode
          ? `/organization/members/code/${userCode}`
          : `/organization/members/${memberId}/profile`;

        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt={name} />}
              <AvatarFallback name={name}>{name[0]?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <button
                type="button"
                onClick={() => navigate(profilePath)}
                className="font-semibold text-foreground text-sm leading-snug hover:text-emerald-500 hover:underline cursor-pointer text-left"
              >
                {name}
              </button>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'jobTitle',
      header: 'Job Role',
      cell: (m) => (
        <span className="text-xs text-foreground font-medium">
          {m.jobTitle || 'Team Member'}
        </span>
      ),
    },
    {
      id: 'userRole',
      header: 'Org Role',
      width: '120px',
      cell: (m) => <Badge tone={getRoleBadgeTone(m.userRole || 'Member')}>{m.userRole || 'Member'}</Badge>,
    },
    {
      id: 'userStatus',
      header: 'Status',
      width: '100px',
      cell: (m) => {
        const status = m.userStatus || 'ACTIVE';
        return (
          <Badge tone={status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'danger'}>
            {status}
          </Badge>
        );
      },
    },
    {
      id: 'contact',
      header: 'Contact Details',
      cell: (m) => {
        if (!canManage && m.userId !== user?.userId) {
          return <span className="text-xs text-muted-foreground/60 italic">Private</span>;
        }
        return (
          <div className="space-y-0.5 text-xs">
            {m.phoneNumber ? (
              <div className="flex items-center gap-1 text-foreground">
                <Phone size={12} className="text-muted-foreground" />
                <span>{m.phoneNumber}</span>
              </div>
            ) : (
              <span className="text-muted-foreground/60 italic">No phone</span>
            )}
            {m.bloodType && (
              <div className="flex items-center gap-1 text-red-500 dark:text-red-400 font-medium">
                <Droplet size={12} />
                <span>Blood: {m.bloodType}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: 'address',
      header: 'Address & City',
      cell: (m) => {
        if (!canManage && m.userId !== user?.userId) {
          return <span className="text-xs text-muted-foreground/60 italic">Private</span>;
        }
        const addr = [m.address, m.city].filter(Boolean).join(', ');
        return addr ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} className="shrink-0" />
            <span className="line-clamp-1">{addr}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">N/A</span>
        );
      },
    },
    {
      id: 'joinedDate',
      header: 'Joined Date',
      width: '110px',
      cell: (m) => {
        const created = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'N/A';
        return <span className="text-xs text-muted-foreground font-mono">{created}</span>;
      },
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'right' as const,
            width: '80px',
            cell: (m: Member) => (
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/organization/members/${m.userId}/edit`)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                  title="Edit Member Profile"
                >
                  <Edit2 size={14} />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-6">
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
      />
    </div>
  );
};

export default OrgMembers;
