import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Activity,
  LogOut,
  Sun,
  Moon,
  RefreshCw
} from 'lucide-react';
import { IntellMeetLogo } from '@/components/ui/IntellMeetLogo';
import { useTheme } from '@/context/theme-context';
import { getServerMetricsApi } from '@/api/server-admin/server-admin.api';

export const ServerAdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [prometheusStatus, setPrometheusStatus] = useState<string>('HEALTHY');
  const [refreshing, setRefreshing] = useState(false);

  const checkAuthAndMetrics = useCallback(async () => {
    const token = localStorage.getItem('server_admin_token');
    if (!token) {
      navigate('/server-admin/login', { replace: true });
      return;
    }
    try {
      setRefreshing(true);
      const res = await getServerMetricsApi();
      if (res.data?.data?.metrics?.prometheusStatus) {
        setPrometheusStatus(res.data.data.metrics.prometheusStatus);
      }
    } catch {
          } finally {
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('server_admin_token');
    if (!token) {
      navigate('/server-admin/login', { replace: true });
      return;
    }
    let isMounted = true;
    getServerMetricsApi()
      .then((res) => {
        if (isMounted && res.data?.data?.metrics?.prometheusStatus) {
          setPrometheusStatus(res.data.data.metrics.prometheusStatus);
        }
      })
      .catch(() => {
              });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, navigate]);

  const handleLogout = () => {
    localStorage.removeItem('server_admin_token');
    localStorage.removeItem('server_admin_user');
    navigate('/server-admin/login', { replace: true });
  };

    const getBreadcrumbLabel = () => {
    const path = location.pathname;
    if (path.includes('/organizations/new')) return 'Organizations / New';
    if (path.match(/\/organizations\/[a-zA-Z0-9_-]+/)) return 'Organizations / Details';
    if (path.includes('/organizations')) return 'Organizations';
    if (path.includes('/telemetry')) return 'Telemetry & Health';
    return 'Dashboard';
  };

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden">
      {}
      <aside className="w-64 border-r border-border bg-card flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col">
          {/* Brand Header with separator matching top bar height (h-14) */}
          <div className="h-14 border-b border-border px-4 flex items-center gap-2.5 shrink-0">
            <IntellMeetLogo size={22} />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sm tracking-tight text-foreground">
                Intell<span className="text-emerald-500">Meet</span>
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Server Admin
              </span>
            </div>
          </div>

          {}
          <nav className="p-3 space-y-1">
            <NavLink
              to="/server-admin/dashboard"
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`
              }
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/server-admin/organizations"
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`
              }
            >
              <Building2 size={16} />
              <span>Organizations</span>
            </NavLink>

            <NavLink
              to="/server-admin/telemetry"
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`
              }
            >
              <Activity size={16} />
              <span>Telemetry & Health</span>
            </NavLink>
          </nav>
        </div>

        {/* Sidebar Footer with clean profile and logout icon in same row */}
        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                SA
              </div>
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-xs font-bold truncate text-foreground">serveradmin</span>
                <span className="text-[10px] text-muted-foreground font-mono">ServerAdmin</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Layout Column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar with matching h-14 height and separator */}
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span>Server Admin</span>
              <span>/</span>
              <span className="text-foreground font-semibold">{getBreadcrumbLabel()}</span>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold border border-primary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>Prometheus: {prometheusStatus}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <button
              onClick={() => void checkAuthAndMetrics()}
              disabled={refreshing}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {/* Child Views */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
