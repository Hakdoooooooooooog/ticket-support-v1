'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@ui/card';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import {
  reportsControllerGetSummary,
  reportsControllerExportTicketsCsv,
  reportsControllerExportCsatCsv,
} from '../../api/endpoints/reports/reports';
import { formatTicketDate } from '@lib/helpers';

interface ReportsSummaryData {
  kpis: {
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    needsInfoTickets: number;
    resolvedTickets: number;
    closedTickets: number;
    unassignedTickets: number;
    resolutionRate: number;
  };
  departments: {
    technicalSupport: number;
    general: number;
  };
  csat: {
    totalRatings: number;
    average: number | null;
    distribution: {
      fiveStar: number;
      fourStar: number;
      threeStar: number;
      twoStar: number;
      oneStar: number;
    };
  };
  agents: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    department: string;
    lastAssignedAt: string | null;
    assignedCount: number;
    resolvedCount: number;
    csatAverage: number | null;
    csatRatingsCount: number;
  }>;
}

export function AdminReports() {
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = React.useState<string>('ALL');
  const [isExportingTickets, setIsExportingTickets] = React.useState(false);
  const [isExportingCsat, setIsExportingCsat] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery<ReportsSummaryData>({
    queryKey: ['reports-summary'],
    queryFn: async () => {
      const res = (await reportsControllerGetSummary()) as any;
      return res;
    },
  });

  const handleDownloadTicketsCsv = async () => {
    setIsExportingTickets(true);
    setExportError(null);
    try {
      const queryParams: Record<string, string> = {};
      if (departmentFilter !== 'ALL') queryParams.department = departmentFilter;
      if (statusFilter !== 'ALL') queryParams.status = statusFilter;
      if (priorityFilter !== 'ALL') queryParams.priority = priorityFilter;

      const res = (await reportsControllerExportTicketsCsv(
        queryParams as any,
        { responseType: 'blob' as any },
      )) as any;

      const blob = new Blob([res], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tickets-export-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError('Failed to generate tickets CSV export. Please try again.');
    } finally {
      setIsExportingTickets(false);
    }
  };

  const handleDownloadCsatCsv = async () => {
    setIsExportingCsat(true);
    setExportError(null);
    try {
      const res = (await reportsControllerExportCsatCsv(
        { responseType: 'blob' as any },
      )) as any;

      const blob = new Blob([res], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `csat-ratings-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExportError('Failed to generate CSAT CSV export. Please try again.');
    } finally {
      setIsExportingCsat(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 rounded-xl bg-spruce-100 dark:bg-spruce-900/50" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 rounded-xl bg-spruce-100 dark:bg-spruce-900/50" />
          <div className="h-32 rounded-xl bg-spruce-100 dark:bg-spruce-900/50" />
          <div className="h-32 rounded-xl bg-spruce-100 dark:bg-spruce-900/50" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30">
        <CardContent className="p-6 text-center space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            Could not load reporting dashboard. Ensure staff authentication credentials are valid.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { kpis, departments, csat, agents } = data;

  return (
    <div className="space-y-6">
      {/* 1. Export Action Banner */}
      <Card className="border-spruce-200/90 dark:border-spruce-800 bg-white dark:bg-spruce-900/90 text-spruce-950 dark:text-white shadow-sm border-l-4 border-l-spruce-700 dark:border-l-spruce-300">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-bold text-spruce-950 dark:text-white flex items-center gap-2">
                <span>Data Export &amp; Reporting Studio</span>
                <Badge className="bg-spruce-100 text-spruce-800 dark:bg-spruce-800 dark:text-spruce-200 border border-spruce-300/80 dark:border-spruce-700 text-[10px] font-semibold">
                  RFC 4180 CSV
                </Badge>
              </CardTitle>
              <CardDescription className="text-spruce-600 dark:text-spruce-300 text-xs mt-1">
                Download raw audit logs, customer survey feedback, and operational KPI extracts.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleDownloadTicketsCsv}
                disabled={isExportingTickets}
                className="text-xs font-semibold"
              >
                {isExportingTickets ? 'Generating CSV...' : 'Download Tickets CSV'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCsatCsv}
                disabled={isExportingCsat}
                className="text-xs font-semibold"
              >
                {isExportingCsat ? 'Generating CSV...' : 'Download CSAT Feedback CSV'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-3 text-xs bg-spruce-50/90 dark:bg-spruce-950/60 p-3 rounded-lg border border-spruce-200/90 dark:border-spruce-800">
            <span className="text-spruce-700 dark:text-spruce-300 font-semibold">Export Filter Presets:</span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 rounded-md bg-white dark:bg-spruce-900 border border-spruce-300 dark:border-spruce-700 text-spruce-900 dark:text-white px-2.5 text-xs focus:ring-1 focus:ring-spruce-500 shadow-2xs"
            >
              <option value="ALL">All Departments</option>
              <option value="TECHNICAL_SUPPORT">Tech Support</option>
              <option value="GENERAL">General Scope</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md bg-white dark:bg-spruce-900 border border-spruce-300 dark:border-spruce-700 text-spruce-900 dark:text-white px-2.5 text-xs focus:ring-1 focus:ring-spruce-500 shadow-2xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="NEEDS_INFO">Needs Info</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 rounded-md bg-white dark:bg-spruce-900 border border-spruce-300 dark:border-spruce-700 text-spruce-900 dark:text-white px-2.5 text-xs focus:ring-1 focus:ring-spruce-500 shadow-2xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          {exportError && (
            <p className="text-xs text-rose-500 mt-2 font-medium">{exportError}</p>
          )}
        </CardContent>
      </Card>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-spruce-500 uppercase tracking-wider">
              Total Volume
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-spruce-950 dark:text-white">
                {kpis.totalTickets}
              </span>
              <Badge variant="secondary" className="text-xs">
                {kpis.resolutionRate}% Resolved
              </Badge>
            </div>
            <p className="text-[11px] text-spruce-500 mt-1">
              {kpis.openTickets} Open · {kpis.inProgressTickets} In Progress
            </p>
          </CardContent>
        </Card>

        <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-spruce-500 uppercase tracking-wider">
              CSAT Score
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {csat.average ? `${csat.average} ★` : 'N/A'}
              </span>
              <Badge variant="outline" className="text-xs font-medium border-emerald-500/30 text-emerald-600">
                {csat.totalRatings} Reviews
              </Badge>
            </div>
            <p className="text-[11px] text-spruce-500 mt-1">
              Average score from post-resolution customer surveys
            </p>
          </CardContent>
        </Card>

        <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-spruce-500 uppercase tracking-wider">
              Tech Support Volume
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-spruce-700 dark:text-spruce-300">
                {departments.technicalSupport}
              </span>
              <Badge variant="outline" className="text-xs font-medium border-spruce-500/30 text-spruce-700 dark:text-spruce-300">
                {kpis.totalTickets > 0 ? `${Math.round((departments.technicalSupport / kpis.totalTickets) * 100)}%` : '0%'}
              </Badge>
            </div>
            <p className="text-[11px] text-spruce-500 mt-1">
              Dedicated technical support tickets
            </p>
          </CardContent>
        </Card>

        <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
          <CardContent className="p-4 sm:p-5">
            <span className="text-xs font-semibold text-spruce-500 uppercase tracking-wider">
              General Scope Volume
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-spruce-600 dark:text-spruce-400">
                {departments.general}
              </span>
              <Badge variant="outline" className="text-xs font-medium border-spruce-400/30 text-spruce-600 dark:text-spruce-400">
                {kpis.totalTickets > 0 ? `${Math.round((departments.general / kpis.totalTickets) * 100)}%` : '0%'}
              </Badge>
            </div>
            <p className="text-[11px] text-spruce-500 mt-1">
              General inquiries and triage requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Department Breakdown & CSAT Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Department Ticket Allocation</CardTitle>
            <CardDescription className="text-xs">
              Breakdown of tickets routed through automated round-robin departments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-medium">
                <span>Technical Support</span>
                <span>{departments.technicalSupport} tickets</span>
              </div>
              <div className="h-2 rounded-full bg-spruce-100 dark:bg-spruce-800 overflow-hidden">
                <div
                  className="h-full bg-spruce-600 dark:bg-spruce-400 transition-all duration-300"
                  style={{
                    width: `${kpis.totalTickets > 0 ? (departments.technicalSupport / kpis.totalTickets) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1 font-medium">
                <span>General Scope</span>
                <span>{departments.general} tickets</span>
              </div>
              <div className="h-2 rounded-full bg-spruce-100 dark:bg-spruce-800 overflow-hidden">
                <div
                  className="h-full bg-spruce-500/80 dark:bg-spruce-500 transition-all duration-300"
                  style={{
                    width: `${kpis.totalTickets > 0 ? (departments.general / kpis.totalTickets) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">CSAT Rating Distribution</CardTitle>
            <CardDescription className="text-xs">
              Breakdown of customer feedback ratings from 1 to 5 stars.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {[
              { stars: 5, count: csat.distribution.fiveStar, color: 'bg-emerald-500' },
              { stars: 4, count: csat.distribution.fourStar, color: 'bg-emerald-400' },
              { stars: 3, count: csat.distribution.threeStar, color: 'bg-amber-400' },
              { stars: 2, count: csat.distribution.twoStar, color: 'bg-orange-400' },
              { stars: 1, count: csat.distribution.oneStar, color: 'bg-rose-500' },
            ].map((rating) => {
              const pct = csat.totalRatings > 0 ? Math.round((rating.count / csat.totalRatings) * 100) : 0;
              return (
                <div key={rating.stars} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 font-medium">{rating.stars} ★</span>
                  <div className="flex-1 h-2 rounded-full bg-spruce-100 dark:bg-spruce-800 overflow-hidden">
                    <div className={`h-full ${rating.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-spruce-500">{rating.count} ({pct}%)</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* 4. Staff Round-Robin Workload & Resolution Leaderboard */}
      <Card className="border-spruce-200 dark:border-spruce-800 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold">Staff Round-Robin Workload &amp; Performance</CardTitle>
          <CardDescription className="text-xs">
            Automated round-robin distribution metrics and resolution statistics per support engineer.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-spruce-100/60 dark:bg-spruce-900/40 text-spruce-600 dark:text-spruce-400 font-semibold border-y border-spruce-200 dark:border-spruce-800">
              <tr>
                <th className="py-2.5 px-4">Staff Member</th>
                <th className="py-2.5 px-4">Department</th>
                <th className="py-2.5 px-4">Assigned Tickets</th>
                <th className="py-2.5 px-4">Resolved Count</th>
                <th className="py-2.5 px-4">CSAT Average</th>
                <th className="py-2.5 px-4">Last Round-Robin Turn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-spruce-100 dark:divide-spruce-800/60">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-spruce-50/50 dark:hover:bg-spruce-900/20">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-spruce-950 dark:text-white">
                      {agent.fullName}
                    </div>
                    <div className="text-[11px] text-spruce-500">{agent.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-[10px] font-medium border-spruce-300 dark:border-spruce-700">
                      {agent.department === 'GENERAL' ? 'General Scope' : 'Tech Support'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 font-semibold text-spruce-900 dark:text-spruce-100">
                    {agent.assignedCount}
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                    {agent.resolvedCount}
                  </td>
                  <td className="py-3 px-4">
                    {agent.csatAverage ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {agent.csatAverage} ★ ({agent.csatRatingsCount})
                      </span>
                    ) : (
                      <span className="text-spruce-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-spruce-500">
                    {agent.lastAssignedAt ? formatTicketDate(agent.lastAssignedAt) : 'Awaiting turn'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
