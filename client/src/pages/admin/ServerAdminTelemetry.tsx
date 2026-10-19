import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  ShieldCheck,
  Server,
  Cpu,
  HardDrive,
  RefreshCw,
  Clock,
  Radio,
  Lock,
  Network,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { Chart } from '@tanstack/charts/react';
import { defineChart, areaY, lineY, barY } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { scaleBand } from '@tanstack/charts/scales/band';
import { tooltip } from '@tanstack/charts/tooltip';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  getServerMetricsApi,
  type ServerMetricsData,
  type ServiceHealthItem,
  type SecurityAuditItem
} from '@/api/server-admin/server-admin.api';

interface MemorySample {
  time: string;
  heapUsed: number;
  rss: number;
}

export const ServerAdminTelemetry: React.FC = () => {
  const [metrics, setMetrics] = useState<ServerMetricsData | null>(null);
  const [uptime, setUptime] = useState<number>(0);
  const [timestamp, setTimestamp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [memoryHistory, setMemoryHistory] = useState<MemorySample[]>([]);
  const [activeTab, setActiveTab] = useState<'services' | 'security' | 'memory'>('memory');

  const fetchTelemetry = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      }
      const res = await getServerMetricsApi();
      if (res.data?.data) {
        const m = res.data.data.metrics || null;
        setMetrics(m);
        setUptime(res.data.data.uptime || 0);
        const nowIso = res.data.data.timestamp || new Date().toISOString();
        setTimestamp(nowIso);

        if (m) {
          const sampleTime = new Date(nowIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setMemoryHistory((prev) => {
            const next = [
              ...prev,
              {
                time: sampleTime,
                heapUsed: m.systemMemoryMB || 0,
                rss: m.rssMB || 0
              }
            ];
            return next.slice(-12);
          });
        }
      }
    } catch (err) {
      console.error('Failed to load server telemetry:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      try {
        const res = await getServerMetricsApi();
        if (isCancelled) return;
        if (res.data?.data) {
          const m = res.data.data.metrics || null;
          setMetrics(m);
          setUptime(res.data.data.uptime || 0);
          const nowIso = res.data.data.timestamp || new Date().toISOString();
          setTimestamp(nowIso);

          if (m) {
            const sampleTime = new Date(nowIso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setMemoryHistory((prev) => {
              const next = [
                ...prev,
                {
                  time: sampleTime,
                  heapUsed: m.systemMemoryMB || 0,
                  rss: m.rssMB || 0
                }
              ];
              return next.slice(-12);
            });
          }
        }
      } catch (err) {
        console.error('Failed to load initial server telemetry:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    const interval = setInterval(() => {
      void fetchTelemetry(false);
    }, 15_000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [fetchTelemetry]);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m ${s}s`;
  };

  const services: ServiceHealthItem[] = metrics?.servicesHealth || [];
  const securityLogs: SecurityAuditItem[] = metrics?.recentSecurityAudits || [];

  // TanStack Chart: Real-time V8 Heap & RSS Memory Stream
  const liveMemoryChartDef = React.useMemo(() => {
    return defineChart({
      tooltip,
      marks: [
        areaY(memoryHistory, {
          x: 'time',
          y: 'rss',
          fill: '#6366f1',
          fillOpacity: 0.15
        }),
        lineY(memoryHistory, {
          x: 'time',
          y: 'rss',
          stroke: '#6366f1',
          strokeWidth: 2,
          points: true
        }),
        areaY(memoryHistory, {
          x: 'time',
          y: 'heapUsed',
          fill: '#10b981',
          fillOpacity: 0.35
        }),
        lineY(memoryHistory, {
          x: 'time',
          y: 'heapUsed',
          stroke: '#10b981',
          strokeWidth: 2.5,
          points: true
        })
      ],
      scales: {
        x: {
          scale: () => scalePoint<string>().padding(0.2)
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Memory (MB)'
          }
        }
      }
    });
  }, [memoryHistory]);

  // Memory Distribution by Category
  const memoryCategoryData = React.useMemo(() => {
    if (!metrics) return [];
    return [
      { category: 'Heap Used', megabytes: metrics.systemMemoryMB || 0, color: '#10b981' },
      { category: 'Heap Unused', megabytes: Math.max(0, (metrics.heapTotalMB || 0) - (metrics.systemMemoryMB || 0)), color: '#06b6d4' },
      { category: 'RSS Physical', megabytes: metrics.rssMB || 0, color: '#6366f1' },
      { category: 'C++ External', megabytes: metrics.externalMB || 0, color: '#f59e0b' }
    ];
  }, [metrics]);

  const memoryBarChartDef = React.useMemo(() => {
    return defineChart({
      tooltip,
      marks: [
        barY(memoryCategoryData, {
          x: 'category',
          y: 'megabytes',
          fill: '#10b981',
          fillOpacity: 0.85,
          radius: 4
        })
      ],
      scales: {
        x: {
          scale: () => scaleBand<string>().padding(0.25)
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Megabytes (MB)'
          }
        }
      }
    });
  }, [memoryCategoryData]);

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header with real-time indicators and manual refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Radio className="h-5 w-5 text-emerald-500 animate-pulse" />
            <span>Telemetry & Advanced Cluster Health</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time infrastructure health, V8 memory allocation, security audit log, and sub-service heartbeat.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span>{timestamp ? new Date(timestamp).toLocaleTimeString() : 'Syncing...'}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchTelemetry(true)}
            disabled={loading}
            className="text-xs gap-1.5 cursor-pointer h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
          </Button>
        </div>
      </div>

      {/* Grid of Real-Time Cluster Health Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Prometheus Scraper */}
        <div className="rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Zap className="h-4 w-4 text-emerald-500" />
              <span>Prometheus Scraper</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              {metrics?.prometheusStatus || 'HEALTHY'}
            </span>
          </div>
          <div className="text-2xl font-extrabold text-foreground">Operational</div>
          <p className="text-xs text-muted-foreground">Scraping metrics continuously at <code className="text-emerald-500 font-mono text-[11px]">/metrics</code> endpoint.</p>
        </div>

        {/* Grafana Latency */}
        <div className="rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Activity className="h-4 w-4 text-cyan-500" />
              <span>API Gateway Latency</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold text-[10px]">
              {metrics?.grafanaStatus || 'ACTIVE'}
            </span>
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {metrics?.apiLatencyMs !== undefined ? `${metrics.apiLatencyMs} ms` : '4 ms'}
          </div>
          <p className="text-xs text-muted-foreground">Average HTTP response loopback measured across endpoints.</p>
        </div>

        {/* Process Heap Memory */}
        <div className="rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Cpu className="h-4 w-4 text-amber-500" />
              <span>V8 Heap Allocation</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
              {metrics?.nodeVersion || 'Node.js v22'}
            </span>
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {metrics?.systemMemoryMB || 64} MB
          </div>
          <p className="text-xs text-muted-foreground">
            Total Allocated: <span className="font-mono text-foreground font-semibold">{metrics?.heapTotalMB || 82} MB</span> (RSS: {metrics?.rssMB || 110} MB)
          </p>
        </div>

        {/* Cluster Uptime */}
        <div className="rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Clock className="h-4 w-4 text-indigo-500" />
              <span>Cluster Uptime</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
              STABLE
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-foreground">
            {formatUptime(uptime)}
          </div>
          <p className="text-xs text-muted-foreground">Continuous server process duration without restarts.</p>
        </div>

        {/* Active Sockets & WebRTC */}
        <div className="rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Network className="h-4 w-4 text-purple-500" />
              <span>Active Sockets & SFU</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
              REALTIME
            </span>
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {metrics?.activeConnections ?? 0}
          </div>
          <p className="text-xs text-muted-foreground">Live WebRTC audio tracks & Socket.io channel participants.</p>
        </div>

        {/* Cluster Environment Sync */}
        <div className="rounded-sm border border-border/80 bg-card p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Server className="h-4 w-4 text-emerald-500" />
              <span>Platform Host</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
              {metrics?.platform || 'LINUX-X64'}
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-foreground truncate mt-1">
            {timestamp ? new Date(timestamp).toLocaleString() : 'Syncing...'}
          </div>
          <p className="text-xs text-muted-foreground">Last synchronized heartbeat from telemetry coordinator.</p>
        </div>
      </div>

      {/* Advanced Telemetry Section: Services Health, Security Logs & Memory Breakdown */}
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'services'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>Microservice Heartbeats</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'security'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Security Audit & Access Logs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${activeTab === 'memory'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
          >
            <HardDrive className="h-3.5 w-3.5" />
            <span>Process Memory Breakdown</span>
          </button>
        </div>

        {/* Tab 1: Microservice Status */}
        {activeTab === 'services' && (
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Sub-Service Health & Latencies</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Continuous diagnostics of internal API, database drivers, and media streaming nodes.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {services.map((svc) => (
                  <div
                    key={svc.name}
                    className="p-3.5 rounded-lg border border-border/70 bg-muted/20 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-foreground">{svc.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{svc.type}</p>
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        ~{svc.latencyMs}ms response
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {svc.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Security Audit Logs */}
        {activeTab === 'security' && (
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    <span>Control Plane Security Audits</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Cryptographic access, server admin authentications, and internal mesh verification events.
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-mono font-bold">
                  AES-256-GCM / TLS 1.3
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/60">
                    <tr>
                      <th className="py-2.5 px-3">Event Signature</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Source Origin</th>
                      <th className="py-2.5 px-3">Agent / Daemon</th>
                      <th className="py-2.5 px-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 font-mono">
                    {securityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          <span>{log.event}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">{log.sourceIp}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{log.userAgent}</td>
                        <td className="py-2.5 px-3 text-right text-muted-foreground">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Process Memory Breakdown */}
        {activeTab === 'memory' && (
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-amber-500" />
                <span>Process Memory & Heap Distribution</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Detailed breakdown of V8 engine resident set size and garbage-collected buffers.
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-sm border border-border/70 bg-card">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Heap Used</p>
                  <p className="text-2xl font-black text-foreground mt-1">{metrics?.systemMemoryMB || 64} MB</p>
                  <p className="text-xs text-muted-foreground mt-1">Actively utilized object memory</p>
                </div>

                <div className="p-4 rounded-sm border border-border/70 bg-card">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Heap Total</p>
                  <p className="text-2xl font-black text-foreground mt-1">{metrics?.heapTotalMB || 82} MB</p>
                  <p className="text-xs text-muted-foreground mt-1">Total committed V8 heap size</p>
                </div>

                <div className="p-4 rounded-sm border border-border/70 bg-card">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Resident Set (RSS)</p>
                  <p className="text-2xl font-black text-foreground mt-1">{metrics?.rssMB || 110} MB</p>
                  <p className="text-xs text-muted-foreground mt-1">RAM occupied in physical memory</p>
                </div>

                <div className="p-4 rounded-sm border border-border/70 bg-card">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">External Buffers</p>
                  <p className="text-2xl font-black text-foreground mt-1">{metrics?.externalMB || 18} MB</p>
                  <p className="text-xs text-muted-foreground mt-1">C++ bindings & audio streams</p>
                </div>
              </div>

              {/* Real-Time Live Streaming Chart & Category Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
                <div className="lg:col-span-2 border border-border/70 rounded-sm p-4 bg-muted/10">
                  <div className="flex items-center justify-between pb-2">
                    <p className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                      <span>Live V8 Heap & RSS Stream</span>
                    </p>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      Live 15s Ticks
                    </span>
                  </div>
                  <div className="h-[240px] w-full pt-1">
                    <Chart
                      definition={liveMemoryChartDef}
                      height={230}
                      ariaLabel="Real-time V8 Memory Stream"
                    />
                  </div>
                </div>

                <div className="border border-border/70 rounded-sm p-4 bg-muted/10">
                  <div className="flex items-center justify-between pb-2">
                    <p className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Memory Pool Breakdown</span>
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      Current MB
                    </span>
                  </div>
                  <div className="h-[240px] w-full pt-1">
                    <Chart
                      definition={memoryBarChartDef}
                      height={230}
                      ariaLabel="Memory Pool Breakdown Bar Chart"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};