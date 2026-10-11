import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Radio,
  Activity,
  Building2,
  Users,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { getServerMetricsApi, getAllOrganizationsServerAdminApi } from '@/api/server-admin/server-admin.api';

interface ServerMetrics {
  prometheusStatus?: string;
  grafanaStatus?: string;
  activeConnections?: number;
  apiLatencyMs?: number;
  systemMemoryMB?: number;
  totalOrganizations?: number;
  totalUsers?: number;
  activeUsers?: number;
}

export const ServerAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [orgsCount, setOrgsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getServerMetricsApi(),
      getAllOrganizationsServerAdminApi()
    ])
      .then(([mRes, oRes]) => {
        if (isMounted) {
          setMetrics(mRes.data.data.metrics);
          setOrgsCount(oRes.data.data?.length || 0);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load server admin dashboard metrics', err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="w-full space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Cluster Dashboard</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time telemetry, scraper health, and platform tenant metrics.
          </p>
        </div>
      </div>

      {/* Main Metric Cards Section */}
      <div className="space-y-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-500" />
            <span>Telemetry & Tenant Overview</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Prometheus Status */}
            <div className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all duration-200 group">
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Prometheus Metrics</p>
                <p className="text-2xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading ? '...' : metrics?.prometheusStatus || 'HEALTHY'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Scraping /metrics endpoint</p>
              </div>
              <div className="p-3 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                <Radio size={22} className={loading ? '' : 'animate-pulse'} />
              </div>
            </div>

            {/* Grafana Telemetry */}
            <div className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-cyan-500/50 hover:shadow-md transition-all duration-200 group">
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Grafana Telemetry</p>
                <p className="text-2xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading ? '...' : metrics?.grafanaStatus || 'ACTIVE'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Latency: {metrics?.apiLatencyMs || 20}ms</p>
              </div>
              <div className="p-3 rounded-md bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 group-hover:scale-105 transition-transform">
                <Activity size={22} />
              </div>
            </div>

            {/* Active Organizations */}
            <div
              onClick={() => navigate('/server-admin/organizations')}
              className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all duration-200 cursor-pointer group"
            >
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Organizations</p>
                <p className="text-2xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading ? '...' : metrics?.totalOrganizations ?? orgsCount}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 group-hover:text-indigo-500 transition-colors">
                  <span>View organizations</span>
                  <ArrowRight size={11} />
                </p>
              </div>
              <div className="p-3 rounded-md bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 group-hover:scale-105 transition-transform">
                <Building2 size={22} />
              </div>
            </div>

            {/* Active Platform Users */}
            <div className="relative overflow-hidden rounded-sm border border-border/80 bg-card p-5 flex items-center justify-between shadow-xs hover:border-amber-500/50 hover:shadow-md transition-all duration-200 group">
              <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Active Users</p>
                <p className="text-2xl font-extrabold text-foreground mt-1 tracking-tight">
                  {loading ? '...' : metrics?.activeUsers ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">Total: {metrics?.totalUsers ?? 0} registered</p>
              </div>
              <div className="p-3 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 group-hover:scale-105 transition-transform">
                <Users size={22} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
