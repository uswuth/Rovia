import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Clock,
  UserX,
  FolderKanban,
  UsersRound,
  Video,
  CheckSquare,
  TrendingUp,
} from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { getProjects } from '@/api/project/project.api';
import { getTeamsApi } from '@/api/teams/teams.api';
import { getMeetings } from '@/api/meeting/meeting.api';
import { getTasksApi } from '@/api/tasks/tasks.api';
import { extractApiItems } from '@/utils/apiResponse';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { members } = useOrganization();

  const [projectsCount, setProjectsCount] = useState<number | null>(null);
  const [teamsCount, setTeamsCount] = useState<number | null>(null);
  const [meetingsCount, setMeetingsCount] = useState<number | null>(null);
  const [tasksCount, setTasksCount] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const totalMembers = members.length;
  const activeAdmins = members.filter(
    (m) => m.userRole === 'SuperAdmin' || m.userRole === 'Admin'
  ).length;
  const pendingMembers = members.filter((m) => m.userStatus === 'DEACTIVATED').length;
  const suspendedMembers = members.filter((m) => m.userStatus === 'SUSPENDED').length;

  useEffect(() => {
    let isMounted = true;
    const fetchDashboardCounts = async () => {
      try {
        setLoading(true);
        const [projRes, teamsRes, meetingsRes, tasksRes] = await Promise.allSettled([
          getProjects(),
          getTeamsApi(),
          getMeetings(),
          getTasksApi(),
        ]);

        if (!isMounted) return;

        setProjectsCount(projRes.status === 'fulfilled' ? extractApiItems(projRes.value).length : 0);
        setTeamsCount(teamsRes.status === 'fulfilled' ? extractApiItems(teamsRes.value).length : 0);
        setMeetingsCount(meetingsRes.status === 'fulfilled' ? extractApiItems(meetingsRes.value).length : 0);
        setTasksCount(tasksRes.status === 'fulfilled' ? extractApiItems(tasksRes.value).length : 0);
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchDashboardCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full bg-background text-foreground p-6 lg:p-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Dashboard</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time metric summary for organization workspaces, projects, teams, meetings, and tasks.
          </p>
        </div>
      </div>

      {/* Main Metric Cards Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-500" />
            <span>Workspace Overview</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* No. of Projects */}
            <div
              onClick={() => navigate('/projects')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-blue-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">No of Projects</p>
                <p className="text-3xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading || projectsCount === null ? '...' : projectsCount}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-xs group-hover:scale-105 transition-transform">
                <FolderKanban size={22} />
              </div>
            </div>

            {/* No. of Teams */}
            <div
              onClick={() => navigate('/teams')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">No of Teams</p>
                <p className="text-3xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading || teamsCount === null ? '...' : teamsCount}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-xs group-hover:scale-105 transition-transform">
                <UsersRound size={22} />
              </div>
            </div>

            {/* No. of Meetings */}
            <div
              onClick={() => navigate('/meetings')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-purple-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">No of Meetings</p>
                <p className="text-3xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading || meetingsCount === null ? '...' : meetingsCount}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-xs group-hover:scale-105 transition-transform">
                <Video size={22} />
              </div>
            </div>

            {/* No. of Tasks */}
            <div
              onClick={() => navigate('/tasks')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-amber-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">No of Tasks</p>
                <p className="text-3xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading || tasksCount === null ? '...' : tasksCount}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs group-hover:scale-105 transition-transform">
                <CheckSquare size={22} />
              </div>
            </div>
          </div>
        </div>

        {/* Organization Members Overview */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Users size={14} className="text-emerald-500" />
            <span>Organization Roster</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              onClick={() => navigate('/organization/members')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-emerald-500/30 transition-all duration-200 cursor-pointer group"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Members</p>
                <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">{totalMembers}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-xs">
                <Users size={19} />
              </div>
            </div>

            <div
              onClick={() => navigate('/organization/members')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-purple-500/30 transition-all duration-200 cursor-pointer group"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Admins & Owners</p>
                <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">{activeAdmins}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-purple-500/10 text-purple-500 border border-purple-500/20 shadow-xs">
                <ShieldCheck size={19} />
              </div>
            </div>

            <div
              onClick={() => navigate('/organization/members')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-amber-500/30 transition-all duration-200 cursor-pointer group"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending Approvals</p>
                <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">{pendingMembers}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-xs">
                <Clock size={19} />
              </div>
            </div>

            <div
              onClick={() => navigate('/organization/members')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-red-500/30 transition-all duration-200 cursor-pointer group"
            >
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Suspended Accounts</p>
                <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">{suspendedMembers}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-red-500/10 text-red-500 border border-red-500/20 shadow-xs">
                <UserX size={19} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
