"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@ui/card";
import { Button } from "@ui/button";
import { Badge } from "@ui/badge";
import { Input } from "@ui/input";
import {
  auditControllerFindAll,
  auditControllerGetSettings,
  auditControllerUpdateSettings,
} from "@api/endpoints/audit/audit";
import { formatCommentTime } from "@lib/helpers";

export interface AuditRecord {
  id: string;
  createdAt: string;
  actorId?: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: Record<string, unknown> | null;
  ip?: string | null;
}

export interface AuditSettingsResponse {
  id: string;
  retentionDays?: number | null;
  updatedAt?: string;
  createdAt?: string;
}

export interface AuditLogsResponse {
  data: AuditRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function AdminAuditLogs() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [emailSearch, setEmailSearch] = useState("");
  const [retentionDaysInput, setRetentionDaysInput] = useState("");

  const { data: logsDataRaw, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["auditLogs", page, actionFilter, emailSearch],
    queryFn: async () => {
      const res = await auditControllerFindAll({
        page,
        limit: 15,
        action: actionFilter || undefined,
        actorEmail: emailSearch || undefined,
      });
      return res as unknown as AuditLogsResponse;
    },
  });

  const { data: settingsDataRaw, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["auditSettings"],
    queryFn: async () => {
      const res = await auditControllerGetSettings();
      return res as unknown as AuditSettingsResponse;
    },
  });

  useEffect(() => {
    if (settingsDataRaw && settingsDataRaw.retentionDays !== undefined) {
      setRetentionDaysInput(
        settingsDataRaw.retentionDays === null ? "" : String(settingsDataRaw.retentionDays),
      );
    }
  }, [settingsDataRaw]);

  const updateSettingsMutation = useMutation({
    mutationFn: (days: number | null) =>
      auditControllerUpdateSettings({ retentionDays: days }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auditSettings"] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs"] });
    },
  });

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    const parsed = retentionDaysInput.trim() ? parseInt(retentionDaysInput, 10) : null;
    updateSettingsMutation.mutate(parsed);
  };

  const logs = logsDataRaw?.data || [];
  const meta = logsDataRaw?.meta || { total: 0, page: 1, totalPages: 1 };

  return (
    <div className="space-y-6">
      {/* Retention Policy Settings Card */}
      <Card className="border border-spruce-200 dark:border-spruce-800 bg-white dark:bg-spruce-900/40">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-spruce-900 dark:text-spruce-100 flex items-center gap-2">
                Audit Trail Immutability & Retention
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500 text-emerald-600 dark:text-emerald-400">
                  DB Protected (Append-Only)
                </Badge>
              </h2>
              <p className="text-xs text-spruce-500 dark:text-spruce-400 mt-0.5">
                Audit logs are locked against manual modification or deletion via database triggers. Retention purges run strictly per configured policy.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="flex items-center gap-2">
              <Input
                type="number"
                min="1"
                max="3650"
                placeholder="Indefinite (null)"
                value={retentionDaysInput}
                onChange={(e) => setRetentionDaysInput(e.target.value)}
                className="w-36 h-8 text-xs"
              />
              <span className="text-xs text-spruce-500">days</span>
              <Button
                type="submit"
                size="sm"
                disabled={updateSettingsMutation.isPending || isLoadingSettings}
                className="h-8 text-xs shrink-0"
              >
                {updateSettingsMutation.isPending ? "Saving..." : "Save Policy"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Input
            placeholder="Filter by actor email..."
            value={emailSearch}
            onChange={(e) => {
              setEmailSearch(e.target.value);
              setPage(1);
            }}
            className="text-xs h-8 w-48"
          />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 text-xs rounded-md border border-spruce-200 dark:border-spruce-700 bg-white dark:bg-spruce-900 text-spruce-800 dark:text-spruce-200"
          >
            <option value="">All Actions</option>
            <option value="TICKET_CREATED">Ticket Created</option>
            <option value="TICKET_UPDATED">Ticket Updated</option>
            <option value="TICKET_DELETED">Ticket Deleted</option>
            <option value="AUDIT_SETTINGS_UPDATED">Settings Updated</option>
            <option value="AUDIT_LOGS_PURGED">Retention Purged</option>
          </select>
        </div>

        <span className="text-xs text-spruce-500 dark:text-spruce-400 self-end sm:self-center">
          Total records: <strong className="text-spruce-800 dark:text-spruce-200">{meta.total}</strong>
        </span>
      </div>

      {/* Logs Table */}
      <div className="border border-spruce-200 dark:border-spruce-800 rounded-lg overflow-hidden bg-white dark:bg-spruce-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-spruce-50/70 dark:bg-spruce-800/50 border-b border-spruce-200 dark:border-spruce-800 text-spruce-600 dark:text-spruce-300">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                <th className="py-2.5 px-3 font-semibold">Actor</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
                <th className="py-2.5 px-3 font-semibold">Entity</th>
                <th className="py-2.5 px-3 font-semibold">Summary</th>
                <th className="py-2.5 px-3 font-semibold">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-spruce-100 dark:divide-spruce-800/80">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-spruce-400">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-spruce-400">
                    No audit records found matching criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-spruce-50/40 dark:hover:bg-spruce-800/30">
                    <td className="py-2.5 px-3 whitespace-nowrap text-spruce-500 dark:text-spruce-400">
                      {formatCommentTime(log.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-medium text-spruce-900 dark:text-spruce-100">
                        {log.actorEmail}
                      </div>
                      <span className="text-[10px] text-spruce-500">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-spruce-600 dark:text-spruce-300">
                      {log.entityType} #{log.entityId.slice(-6)}
                    </td>
                    <td className="py-2.5 px-3 text-spruce-800 dark:text-spruce-200">
                      {log.summary}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-spruce-600 dark:text-spruce-400 max-w-xs truncate">
                      {log.changes ? JSON.stringify(log.changes) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {meta.totalPages > 1 && (
          <div className="p-3 border-t border-spruce-200 dark:border-spruce-800 flex items-center justify-between text-xs">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 text-xs"
            >
              Previous
            </Button>
            <span className="text-spruce-500">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="h-7 text-xs"
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
