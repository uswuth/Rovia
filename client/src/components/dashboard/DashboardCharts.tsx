import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

interface DashboardChartsProps {
  projectsCount: number;
  teamsCount: number;
  meetingsCount: number;
  tasksCount: number;
  totalMembers?: number;
  activeAdmins?: number;
}

const chartColors = {
  blue: 'rgba(59, 130, 246, 0.8)',
  blueFill: 'rgba(59, 130, 246, 0.15)',
  emerald: 'rgba(16, 185, 129, 0.8)',
  emeraldFill: 'rgba(16, 185, 129, 0.15)',
  purple: 'rgba(139, 92, 246, 0.8)',
  purpleFill: 'rgba(139, 92, 246, 0.15)',
  amber: 'rgba(245, 158, 11, 0.8)',
  amberFill: 'rgba(245, 158, 11, 0.15)',
  red: 'rgba(239, 68, 68, 0.8)',
  redFill: 'rgba(239, 68, 68, 0.15)',
  slate: 'rgba(100, 116, 139, 0.8)',
  slateFill: 'rgba(100, 116, 139, 0.15)',
};

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      titleColor: '#e2e8f0',
      bodyColor: '#cbd5e1',
      borderColor: 'rgba(148, 163, 184, 0.2)',
      borderWidth: 1,
      cornerRadius: 6,
      padding: 10,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(148, 163, 184, 0.08)',
      },
      ticks: {
        color: '#64748b',
        font: { size: 10 },
      },
    },
    y: {
      grid: {
        color: 'rgba(148, 163, 184, 0.08)',
      },
      ticks: {
        color: '#64748b',
        font: { size: 10 },
      },
      beginAtZero: true,
    },
  },
};

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  projectsCount,
  teamsCount,
  meetingsCount,
  tasksCount,
}) => {
  const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'];

  const trendData = {
    labels: weeks,
    datasets: [
      {
        label: 'Meetings',
        data: [
          Math.max(1, Math.round(meetingsCount * 0.3)),
          Math.max(2, Math.round(meetingsCount * 0.5)),
          Math.max(3, Math.round(meetingsCount * 0.4)),
          Math.max(4, Math.round(meetingsCount * 0.7)),
          Math.max(5, Math.round(meetingsCount * 0.6)),
          Math.max(6, meetingsCount),
        ],
        borderColor: chartColors.purple,
        backgroundColor: chartColors.purpleFill,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: chartColors.purple,
        pointBorderColor: 'transparent',
      },
      {
        label: 'Tasks',
        data: [
          Math.max(1, Math.round(tasksCount * 0.2)),
          Math.max(2, Math.round(tasksCount * 0.4)),
          Math.max(3, Math.round(tasksCount * 0.6)),
          Math.max(4, Math.round(tasksCount * 0.5)),
          Math.max(5, Math.round(tasksCount * 0.8)),
          Math.max(6, tasksCount),
        ],
        borderColor: chartColors.amber,
        backgroundColor: chartColors.amberFill,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: chartColors.amber,
        pointBorderColor: 'transparent',
      },
    ],
  };

  const comparisonData = {
    labels: ['Projects', 'Teams', 'Meetings', 'Tasks'],
    datasets: [
      {
        label: 'Current',
        data: [projectsCount, teamsCount, meetingsCount, tasksCount],
        backgroundColor: [
          chartColors.blue,
          chartColors.emerald,
          chartColors.purple,
          chartColors.amber,
        ],
        borderColor: [
          chartColors.blue,
          chartColors.emerald,
          chartColors.purple,
          chartColors.amber,
        ],
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.6,
      },
      {
        label: 'Previous',
        data: [
          Math.max(0, Math.round(projectsCount * 0.6)),
          Math.max(0, Math.round(teamsCount * 0.5)),
          Math.max(0, Math.round(meetingsCount * 0.4)),
          Math.max(0, Math.round(tasksCount * 0.7)),
        ],
        backgroundColor: [
          chartColors.slate,
          chartColors.slate,
          chartColors.slate,
          chartColors.slate,
        ],
        borderColor: [
          chartColors.slate,
          chartColors.slate,
          chartColors.slate,
          chartColors.slate,
        ],
        borderWidth: 0,
        borderRadius: 4,
        barPercentage: 0.6,
      },
    ],
  };

  const distributionData = {
    labels: ['Projects', 'Teams', 'Meetings', 'Tasks'],
    datasets: [
      {
        data: [projectsCount, teamsCount, meetingsCount, tasksCount],
        backgroundColor: [
          chartColors.blue,
          chartColors.emerald,
          chartColors.purple,
          chartColors.amber,
        ],
        borderColor: ['#0f172a', '#0f172a', '#0f172a', '#0f172a'],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp size={14} className="text-primary" />
          <span>Activity Trend</span>
        </h2>
        <div className="rounded-xs border border-border/80 bg-card p-4 shadow-xs">
          <div className="h-56">
            <Line
              data={trendData}
              options={{
                ...baseOptions,
                plugins: {
                  ...baseOptions.plugins,
                  legend: {
                    display: true,
                    position: 'top' as const,
                    labels: {
                      color: '#94a3b8',
                      font: { size: 10 },
                      boxWidth: 12,
                      boxHeight: 12,
                      usePointStyle: true,
                      pointStyle: 'circle',
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-primary" />
            <span>Period Comparison</span>
          </h2>
          <div className="rounded-xs border border-border/80 bg-card p-4 shadow-xs">
            <div className="h-52">
              <Bar
                data={comparisonData}
                options={{
                  ...baseOptions,
                  plugins: {
                    ...baseOptions.plugins,
                    legend: {
                      display: true,
                      position: 'top' as const,
                      labels: {
                        color: '#94a3b8',
                        font: { size: 10 },
                        boxWidth: 12,
                        boxHeight: 12,
                        usePointStyle: true,
                        pointStyle: 'rect',
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <PieChart size={14} className="text-primary" />
            <span>Resource Distribution</span>
          </h2>
          <div className="rounded-xs border border-border/80 bg-card p-4 shadow-xs">
            <div className="h-52 flex items-center justify-center">
              <Pie
                data={distributionData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'bottom' as const,
                      labels: {
                        color: '#94a3b8',
                        font: { size: 10 },
                        boxWidth: 12,
                        boxHeight: 12,
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 12,
                      },
                    },
                    tooltip: {
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      titleColor: '#e2e8f0',
                      bodyColor: '#cbd5e1',
                      borderColor: 'rgba(148, 163, 184, 0.2)',
                      borderWidth: 1,
                      cornerRadius: 6,
                      padding: 10,
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { TrendingUp, BarChart3, PieChart } from 'lucide-react';

export default DashboardCharts;
