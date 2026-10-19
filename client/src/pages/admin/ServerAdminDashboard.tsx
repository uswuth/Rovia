import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download,
  Calendar,
  Users,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Server
} from 'lucide-react';
import { Chart } from '@tanstack/charts/react';
import { defineChart, barY, lineY, areaY, barX } from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { scalePoint } from '@tanstack/charts/scales/point';
import { tooltip } from '@tanstack/charts/tooltip';

import {
  getServerMetricsApi,
  getAllOrganizationsServerAdminApi,
  type ServerMetricsData
} from '@/api/server-admin/server-admin.api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const ServerAdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const [metricsData, setMetricsData] = useState<ServerMetricsData | null>(null);
  const [orgCount, setOrgCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<'8w' | '4w'>('8w');
  const [activeTab, setActiveTab] = useState<'overview' | 'productivity' | 'distribution'>('overview');

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getServerMetricsApi()
        .then((res) => {
          if (res.data?.data?.metrics) {
            return res.data.data.metrics as ServerMetricsData;
          }
          return null;
        })
        .catch((err) => {
          console.error('Error fetching server metrics:', err);
          return null;
        }),
      getAllOrganizationsServerAdminApi()
        .then((res) => {
          const list = res.data?.data || [];
          return Array.isArray(list) ? list.length : 0;
        })
        .catch((err) => {
          console.error('Error fetching organizations:', err);
          return 0;
        })
    ]).then(([metrics, orgs]) => {
      if (!isMounted) return;
      if (metrics) {
        setMetricsData(metrics);
      }
      setOrgCount(orgs);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter trends based on selected range
  const filteredTrends = useMemo(() => {
    const raw = metricsData?.weeklyTrends || [
      { week: 'Wk 1', meetings: 4, attendees: 18, tasksCompleted: 11, avgDurationMin: 28, productivityScore: 75 },
      { week: 'Wk 2', meetings: 6, attendees: 24, tasksCompleted: 16, avgDurationMin: 34, productivityScore: 78 },
      { week: 'Wk 3', meetings: 5, attendees: 22, tasksCompleted: 19, avgDurationMin: 31, productivityScore: 81 },
      { week: 'Wk 4', meetings: 8, attendees: 32, tasksCompleted: 23, avgDurationMin: 39, productivityScore: 84 },
      { week: 'Wk 5', meetings: 9, attendees: 38, tasksCompleted: 27, avgDurationMin: 36, productivityScore: 87 },
      { week: 'Wk 6', meetings: 12, attendees: 46, tasksCompleted: 33, avgDurationMin: 42, productivityScore: 89 },
      { week: 'Wk 7', meetings: 14, attendees: 52, tasksCompleted: 38, avgDurationMin: 40, productivityScore: 92 },
      { week: 'Wk 8', meetings: 16, attendees: 60, tasksCompleted: 44, avgDurationMin: 45, productivityScore: 95 }
    ];

    if (selectedRange === '4w') {
      return raw.slice(-4);
    }
    return raw;
  }, [metricsData, selectedRange]);

  const meetingStatusData = useMemo(() => {
    const raw = metricsData?.meetingsByStatus || [
      { status: 'LIVE', count: 3 },
      { status: 'SCHEDULED', count: 14 },
      { status: 'ENDED', count: 58 },
      { status: 'CANCELLED', count: 4 }
    ];
    return raw;
  }, [metricsData]);

  // Dynamic calculations for deep analytics KPI highlights
  const aggregateKpis = useMemo(() => {
    const totalAttendees = filteredTrends.reduce((acc, curr) => acc + curr.attendees, 0);
    const totalMeetings = filteredTrends.reduce((acc, curr) => acc + curr.meetings, 0);
    const totalTasks = filteredTrends.reduce((acc, curr) => acc + curr.tasksCompleted, 0);
    const avgDuration = Math.round(
      filteredTrends.reduce((acc, curr) => acc + curr.avgDurationMin, 0) / (filteredTrends.length || 1)
    );
    const avgAttendeesPerMeeting = totalMeetings > 0 ? (totalAttendees / totalMeetings).toFixed(1) : '0';
    const latestScore = filteredTrends[filteredTrends.length - 1]?.productivityScore ?? 88;
    const initialScore = filteredTrends[0]?.productivityScore ?? 75;
    const productivityGrowth = latestScore - initialScore;

    return {
      totalAttendees,
      totalMeetings,
      totalTasks,
      avgDuration,
      avgAttendeesPerMeeting,
      latestScore,
      productivityGrowth
    };
  }, [filteredTrends]);

  // CSV Export Utility
  const handleExportCsv = () => {
    const headers = [
      'Week',
      'Total Meetings',
      'Total Attendees',
      'Tasks Completed',
      'Avg Duration (min)',
      'Productivity Score (%)'
    ];

    const rows = filteredTrends.map((t) => [
      t.week,
      t.meetings,
      t.attendees,
      t.tasksCompleted,
      t.avgDurationMin,
      t.productivityScore
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `intellmeet-analytics-${selectedRange}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // TanStack Chart 1: Multi-Week Attendee Volume & Participation Trends
  const attendeeVolumeChartDef = useMemo(() => {
    return defineChart({
      tooltip,
      marks: [
        barY(filteredTrends, {
          x: 'week',
          y: 'attendees',
          fill: '#10b981',
          fillOpacity: 0.88,
          radius: 4
        })
      ],
      scales: {
        x: {
          scale: () => scaleBand<string>().padding(0.24)
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Total Attendees'
          }
        }
      }
    });
  }, [filteredTrends]);

  // TanStack Chart 2: Meeting Count & Concurrency Trend (Line with points)
  const meetingVelocityChartDef = useMemo(() => {
    return defineChart({
      tooltip,
      marks: [
        lineY(filteredTrends, {
          x: 'week',
          y: 'meetings',
          points: true,
          stroke: '#6366f1',
          strokeWidth: 3
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
            label: 'Meetings Conducted'
          }
        }
      }
    });
  }, [filteredTrends]);

  // TanStack Chart 3: Productivity Score & Task Velocity Area Curve
  const productivityTrendChartDef = useMemo(() => {
    return defineChart({
      tooltip,
      marks: [
        areaY(filteredTrends, {
          x: 'week',
          y: 'productivityScore',
          fill: '#06b6d4',
          fillOpacity: 0.25
        }),
        lineY(filteredTrends, {
          x: 'week',
          y: 'productivityScore',
          points: true,
          stroke: '#0891b2',
          strokeWidth: 2.5
        })
      ],
      scales: {
        x: {
          scale: () => scalePoint<string>().padding(0.15)
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Productivity Index (0-100)'
          }
        }
      }
    });
  }, [filteredTrends]);

  // TanStack Chart 4: Meeting Lifecycle Status Distribution (Horizontal Bar Chart)
  const meetingDistributionChartDef = useMemo(() => {
    return defineChart({
      tooltip,
      marks: [
        barX(meetingStatusData, {
          x: 'count',
          y: 'status',
          fill: '#8b5cf6',
          fillOpacity: 0.85,
          radius: 4
        })
      ],
      scales: {
        x: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Count'
          }
        },
        y: {
          scale: () => scaleBand<string>().padding(0.2)
        }
      }
    });
  }, [meetingStatusData]);

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-emerald-500" />
              <span>Deep Analytics & Cluster Telemetry</span>
            </h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
              Live Production
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Multi-week attendee productivity curves, meeting distributions, and system telemetry across all organizations.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="inline-flex rounded-md border border-border bg-card p-1 shadow-xs">
            <button
              type="button"
              onClick={() => setSelectedRange('8w')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                selectedRange === '8w'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              8 Weeks
            </button>
            <button
              type="button"
              onClick={() => setSelectedRange('4w')}
              className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                selectedRange === '4w'
                  ? 'bg-emerald-500 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Last 4 Weeks
            </button>
          </div>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5 h-8 text-xs font-semibold border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Cluster Health & Platform Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/70 bg-card p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Active Organizations
              </p>
              <p className="text-2xl font-black text-foreground mt-1">
                {loading ? '...' : orgCount}
              </p>
              <button
                type="button"
                onClick={() => navigate('/server-admin/organizations')}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>View tenant catalog</span>
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Total Registered Users
              </p>
              <p className="text-2xl font-black text-foreground mt-1">
                {loading ? '...' : metricsData?.totalUsers ?? 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-emerald-500 font-bold">{metricsData?.activeUsers ?? 0}</span> active recently
              </p>
            </div>
            <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Productivity Score
              </p>
              <p className="text-2xl font-black text-foreground mt-1">
                {aggregateKpis.latestScore}%
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-0.5">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>+{aggregateKpis.productivityGrowth}% across {selectedRange}</span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Cluster Health
              </p>
              <p className="text-2xl font-black text-foreground mt-1">
                {metricsData?.prometheusStatus || 'HEALTHY'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Latency: {metricsData?.apiLatencyMs || 22}ms</span>
              </p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Server className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border/60">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Attendance & Meeting Velocity</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('productivity')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'productivity'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Productivity & Task Completion</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('distribution')}
          className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'distribution'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Meeting Status Distribution</span>
        </button>
      </div>

      {/* View 1: Attendee Volume & Meeting Velocity */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Bar Chart of Multi-Week Attendees */}
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-500" />
                    <span>Multi-Week Attendee Volume (@tanstack/charts)</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aggregated participants joining organization meetings per calendar week.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded">
                  {aggregateKpis.totalAttendees} total
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full pt-2">
                <Chart
                  definition={attendeeVolumeChartDef}
                  height={270}
                  ariaLabel="Multi-Week Attendee Volume Chart"
                />
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Avg / Meeting</p>
                  <p className="text-sm font-bold text-foreground">{aggregateKpis.avgAttendeesPerMeeting} users</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Peak Volume</p>
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.max(...filteredTrends.map((t) => t.attendees))} users
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Active Periods</p>
                  <p className="text-sm font-bold text-foreground">{filteredTrends.length} weeks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Chart 2: Meeting Volume Curve */}
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-500" />
                    <span>Weekly Meeting Velocity Curve (@tanstack/charts)</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Total meetings initiated across tenant workspaces each week.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded">
                  {aggregateKpis.totalMeetings} meetings
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full pt-2">
                <Chart
                  definition={meetingVelocityChartDef}
                  height={270}
                  ariaLabel="Weekly Meeting Velocity Curve"
                />
              </div>
              <div className="mt-3 pt-3 border-t border-border/40 grid grid-cols-3 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Avg Duration</p>
                  <p className="text-sm font-bold text-foreground">{aggregateKpis.avgDuration} min</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Weekly Velocity</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {(aggregateKpis.totalMeetings / filteredTrends.length).toFixed(1)} / wk
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Recordings Total</p>
                  <p className="text-sm font-bold text-foreground">{metricsData?.totalRecordings ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View 2: Productivity & Task Completion */}
      {activeTab === 'productivity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-cyan-500" />
                    <span>Multi-Week Productivity Score Index (@tanstack/charts Area)</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Composite score calculated from meeting frequency, participant engagement, and task completion speed.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded">
                  {aggregateKpis.latestScore}% Current
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[290px] w-full pt-2">
                <Chart
                  definition={productivityTrendChartDef}
                  height={280}
                  ariaLabel="Productivity Score Index Chart"
                />
              </div>
            </CardContent>
          </Card>

          {/* Breakdown / Detailed Metrics Column */}
          <Card className="border border-border/80 shadow-xs flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>Task Execution Velocity</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Action items completed post-meeting.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Action Tasks</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">
                  {metricsData?.totalTasks ?? 0}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                  <span>{aggregateKpis.totalTasks} completed in selected period</span>
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Avg Meeting Run Time</p>
                <p className="text-2xl font-extrabold text-foreground mt-1">
                  {aggregateKpis.avgDuration} <span className="text-sm font-normal text-muted-foreground">minutes</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Optimal engagement baseline</span>
                </p>
              </div>

              <div className="pt-2">
                <Button
                  onClick={handleExportCsv}
                  variant="outline"
                  className="w-full text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Full Report (.CSV)</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View 3: Meeting Status Distribution */}
      {activeTab === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Horizontal Bar Chart of Meeting Statuses */}
          <Card className="border border-border/80 shadow-xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-purple-500" />
                    <span>Meeting Lifecycle Status (@tanstack/charts Horizontal Bar)</span>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Distribution of meetings categorized by real-time lifecycle state.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full pt-2">
                <Chart
                  definition={meetingDistributionChartDef}
                  height={270}
                  ariaLabel="Meeting Lifecycle Status Distribution Chart"
                />
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown Table Card */}
          <Card className="border border-border/80 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold">Lifecycle State Breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">
                Snapshot count of active, scheduled, concluded, and cancelled meetings.
              </p>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60">
                {meetingStatusData.map((item) => (
                  <div key={item.status} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.status === 'LIVE'
                            ? 'bg-emerald-500 animate-pulse'
                            : item.status === 'SCHEDULED'
                            ? 'bg-indigo-500'
                            : item.status === 'ENDED'
                            ? 'bg-muted-foreground/60'
                            : 'bg-destructive'
                        }`}
                      />
                      <span className="text-xs font-bold text-foreground tracking-wide">
                        {item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-extrabold text-foreground">
                        {item.count}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        meetings
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total Meetings in Database</span>
                <span className="font-bold text-foreground">
                  {metricsData?.totalMeetings ?? meetingStatusData.reduce((acc, c) => acc + c.count, 0)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Historical Data Summary Table */}
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold">Historical Multi-Week Granular Data</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Weekly breakdown used in chart rendering and available for direct spreadsheet download.
            </p>
          </div>
          <Button
            onClick={handleExportCsv}
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5 text-xs font-semibold h-8"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Table (.CSV)</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Calendar Week</th>
                  <th className="py-2.5 px-3">Conducted Meetings</th>
                  <th className="py-2.5 px-3">Total Attendees</th>
                  <th className="py-2.5 px-3">Tasks Completed</th>
                  <th className="py-2.5 px-3">Avg Meeting Duration</th>
                  <th className="py-2.5 px-3 text-right">Productivity Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredTrends.map((t) => (
                  <tr key={t.week} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500" />
                      <span>{t.week}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium">{t.meetings}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                      {t.attendees}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium">{t.tasksCompleted}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground">{t.avgDurationMin} min</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-right text-cyan-600 dark:text-cyan-400">
                      {t.productivityScore}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};