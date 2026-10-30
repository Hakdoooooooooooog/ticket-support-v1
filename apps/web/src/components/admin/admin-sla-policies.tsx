'use client';

import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Button } from '@ui/button';
import { Badge } from '@ui/badge';
import { Input } from '@ui/input';
import {
  useSlaControllerGetAllPolicies,
  useSlaControllerGetAllCalendars,
  useSlaControllerUpdatePolicy,
  useSlaControllerAddHoliday,
  useSlaControllerRemoveHoliday,
  getSlaControllerGetAllPoliciesQueryKey,
  getSlaControllerGetAllCalendarsQueryKey,
} from '@api/endpoints/sla/sla';

interface SlaPolicyItem {
  id: string;
  name: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  department?: string | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  warnAtPercent: number;
  is24x7: boolean;
  enabled: boolean;
  calendar?: {
    id: string;
    name: string;
    timezone: string;
  } | null;
}

interface HolidayItem {
  id: string;
  date: string;
  name: string;
  isMovable: boolean;
}

interface CalendarItem {
  id: string;
  name: string;
  timezone: string;
  isDefault: boolean;
  workingWindows?: Array<{
    id: string;
    weekday: number;
    startMinute: number;
    endMinute: number;
  }>;
  holidays?: HolidayItem[];
}

function formatMinutesDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) {
    return Number.isInteger(hours) ? `${hours}h` : `${Math.floor(hours)}h ${minutes % 60}m`;
  }
  const days = hours / 24;
  return Number.isInteger(days) ? `${days}d (${hours}h)` : `${hours}h`;
}

function formatWeekday(weekday: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[weekday] || `Day ${weekday}`;
}

function formatMinuteTime(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}`;
}

export function AdminSlaPolicies() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'POLICIES' | 'CALENDAR'>('POLICIES');

  // Queries
  const { data: policiesData, isLoading: isLoadingPolicies } = useSlaControllerGetAllPolicies();
  const { data: calendarsData, isLoading: isLoadingCalendars } = useSlaControllerGetAllCalendars();

  const policies = (policiesData as unknown as SlaPolicyItem[]) || [];
  const calendars = (calendarsData as unknown as CalendarItem[]) || [];
  const defaultCalendar = calendars.find((c) => c.isDefault) || calendars[0];

  // Edit Policy State
  const [editingPolicy, setEditingPolicy] = useState<SlaPolicyItem | null>(null);
  const [firstResponseMins, setFirstResponseMins] = useState(60);
  const [resolutionMins, setResolutionMins] = useState(480);
  const [warnPercent, setWarnPercent] = useState(75);
  const [is24x7, setIs24x7] = useState(false);
  const [policyEnabled, setPolicyEnabled] = useState(true);

  // Add Holiday State
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');

  // Mutations
  const updatePolicyMutation = useSlaControllerUpdatePolicy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getSlaControllerGetAllPoliciesQueryKey() });
        setEditingPolicy(null);
      },
    },
  });

  const addHolidayMutation = useSlaControllerAddHoliday({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getSlaControllerGetAllCalendarsQueryKey() });
        setNewHolidayDate('');
        setNewHolidayName('');
      },
    },
  });

  const removeHolidayMutation = useSlaControllerRemoveHoliday({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getSlaControllerGetAllCalendarsQueryKey() });
      },
    },
  });

  const handleStartEdit = (policy: SlaPolicyItem) => {
    setEditingPolicy(policy);
    setFirstResponseMins(policy.firstResponseMinutes);
    setResolutionMins(policy.resolutionMinutes);
    setWarnPercent(policy.warnAtPercent);
    setIs24x7(policy.is24x7);
    setPolicyEnabled(policy.enabled);
  };

  const handleSavePolicy = (e: FormEvent) => {
    e.preventDefault();
    if (!editingPolicy) return;

    updatePolicyMutation.mutate({
      id: editingPolicy.id,
      data: {
        firstResponseMinutes: Number(firstResponseMins),
        resolutionMinutes: Number(resolutionMins),
        warnAtPercent: Number(warnPercent),
        is24x7,
        enabled: policyEnabled,
      },
    });
  };

  const handleAddHoliday = (e: FormEvent) => {
    e.preventDefault();
    if (!defaultCalendar || !newHolidayDate || !newHolidayName) return;

    addHolidayMutation.mutate({
      id: defaultCalendar.id,
      data: {
        date: newHolidayDate,
        name: newHolidayName,
      },
    });
  };

  const handleRemoveHoliday = (holidayId: string) => {
    if (!defaultCalendar) return;
    removeHolidayMutation.mutate({
      id: defaultCalendar.id,
      holidayId,
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-spruce-200 dark:border-spruce-800 pb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === 'POLICIES' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('POLICIES')}
            className="text-xs"
          >
            SLA Policies ({policies.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === 'CALENDAR' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('CALENDAR')}
            className="text-xs"
          >
            Philippine Business Hours &amp; 2026 Holidays
          </Button>
        </div>
        <Badge variant="outline" className="text-[11px] font-mono">
          Timezone: Asia/Manila (UTC+8)
        </Badge>
      </div>

      {activeTab === 'POLICIES' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-spruce-900 dark:text-white">
                SLA Service Level Agreement Targets
              </h3>
              <p className="text-xs text-spruce-500 dark:text-spruce-400">
                Automated deadlines stamped on ticket creation. Pauses on customer follow-ups (NEEDS_INFO).
              </p>
            </div>
          </div>

          {isLoadingPolicies ? (
            <div className="p-8 text-center text-xs text-spruce-400">Loading SLA policies...</div>
          ) : policies.length === 0 ? (
            <div className="p-8 text-center text-xs text-spruce-400">No SLA policies configured.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {policies.map((policy) => {
                const isUrgent = policy.priority === 'URGENT';
                const isHigh = policy.priority === 'HIGH';

                return (
                  <Card
                    key={policy.id}
                    className={`border transition-shadow ${
                      isUrgent
                        ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/10'
                        : isHigh
                          ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10'
                          : 'border-spruce-200 dark:border-spruce-800'
                    }`}
                  >
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isUrgent ? 'destructive' : isHigh ? 'default' : 'outline'}
                          className="font-bold text-[10px]"
                        >
                          {policy.priority}
                        </Badge>
                        <CardTitle className="text-sm font-bold text-spruce-900 dark:text-white">
                          {policy.name}
                        </CardTitle>
                      </div>
                      <Badge variant={policy.enabled ? 'outline' : 'secondary'} className="text-[10px]">
                        {policy.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg bg-spruce-100/60 dark:bg-spruce-900/40 border border-spruce-200/60 dark:border-spruce-800">
                          <span className="text-[10px] text-spruce-500 uppercase font-bold block">
                            First Response
                          </span>
                          <span className="font-semibold text-spruce-900 dark:text-white text-sm">
                            {formatMinutesDuration(policy.firstResponseMinutes)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-spruce-100/60 dark:bg-spruce-900/40 border border-spruce-200/60 dark:border-spruce-800">
                          <span className="text-[10px] text-spruce-500 uppercase font-bold block">
                            Resolution Target
                          </span>
                          <span className="font-semibold text-spruce-900 dark:text-white text-sm">
                            {formatMinutesDuration(policy.resolutionMinutes)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-spruce-600 dark:text-spruce-400 pt-1">
                        <span className="flex items-center gap-1">
                          Coverage:{' '}
                          <strong className="text-spruce-800 dark:text-spruce-200">
                            {policy.is24x7 ? '24/7 Linear' : 'Philippine Working Hours'}
                          </strong>
                        </span>
                        <span>
                          Alert at:{' '}
                          <strong className="text-amber-600 dark:text-amber-400">
                            {policy.warnAtPercent}% threshold
                          </strong>
                        </span>
                      </div>

                      <div className="pt-2 border-t border-spruce-200/60 dark:border-spruce-800/80 flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartEdit(policy)}
                          className="text-xs h-7 px-3"
                        >
                          Configure Policy
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Edit Policy Modal / Drawer */}
          {editingPolicy && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-spruce-950/60 backdrop-blur-xs">
              <div className="w-full max-w-md bg-white dark:bg-spruce-950 rounded-xl shadow-2xl border border-spruce-200 dark:border-spruce-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-spruce-950 dark:text-white">
                    Edit SLA Policy ({editingPolicy.priority})
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingPolicy(null)}
                    className="h-8 w-8 p-0"
                  >
                    ✕
                  </Button>
                </div>

                <form onSubmit={handleSavePolicy} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-spruce-700 dark:text-spruce-300">
                      First Response Target (Minutes)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={firstResponseMins}
                      onChange={(e) => setFirstResponseMins(Number(e.target.value))}
                      className="text-xs"
                      required
                    />
                    <span className="text-[11px] text-spruce-500">
                      Current duration: {formatMinutesDuration(firstResponseMins)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-spruce-700 dark:text-spruce-300">
                      Resolution Target (Minutes)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={resolutionMins}
                      onChange={(e) => setResolutionMins(Number(e.target.value))}
                      className="text-xs"
                      required
                    />
                    <span className="text-[11px] text-spruce-500">
                      Current duration: {formatMinutesDuration(resolutionMins)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-spruce-700 dark:text-spruce-300">
                      Warning Alert Threshold (%)
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={warnPercent}
                      onChange={(e) => setWarnPercent(Number(e.target.value))}
                      className="text-xs"
                      required
                    />
                    <span className="text-[11px] text-spruce-500">
                      Dispatches SLA_WARNING notification at {warnPercent}% of elapsed time.
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="is24x7Check"
                      checked={is24x7}
                      onChange={(e) => setIs24x7(e.target.checked)}
                      className="rounded border-spruce-300 text-spruce-600 focus:ring-spruce-500"
                    />
                    <label htmlFor="is24x7Check" className="text-xs font-medium text-spruce-800 dark:text-spruce-200">
                      24/7 Linear Clock (Ignores business hours and public holidays)
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enabledCheck"
                      checked={policyEnabled}
                      onChange={(e) => setPolicyEnabled(e.target.checked)}
                      className="rounded border-spruce-300 text-spruce-600 focus:ring-spruce-500"
                    />
                    <label htmlFor="enabledCheck" className="text-xs font-medium text-spruce-800 dark:text-spruce-200">
                      Policy Enabled
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-4 border-t border-spruce-200 dark:border-spruce-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingPolicy(null)}
                      disabled={updatePolicyMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={updatePolicyMutation.isPending}
                    >
                      {updatePolicyMutation.isPending ? 'Saving...' : 'Save Policy'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Calendar & Holidays View */
        <div className="space-y-6">
          {isLoadingCalendars ? (
            <div className="p-8 text-center text-xs text-spruce-400">Loading business calendar...</div>
          ) : !defaultCalendar ? (
            <div className="p-8 text-center text-xs text-spruce-400">No calendar found.</div>
          ) : (
            <>
              {/* Working Hours Info Card */}
              <Card className="border-spruce-200 dark:border-spruce-800">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-spruce-900 dark:text-white">
                        {defaultCalendar.name}
                      </CardTitle>
                      <p className="text-xs text-spruce-500 dark:text-spruce-400">
                        Official Working Windows &middot; Timezone: {defaultCalendar.timezone}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      Default Calendar
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                    {[1, 2, 3, 4, 5].map((day) => {
                      const windows = (defaultCalendar.workingWindows || []).filter(
                        (w) => w.weekday === day,
                      );
                      return (
                        <div
                          key={day}
                          className="p-3 rounded-lg bg-spruce-50 dark:bg-spruce-900/40 border border-spruce-200/70 dark:border-spruce-800 space-y-1.5"
                        >
                          <span className="font-bold text-spruce-900 dark:text-white block">
                            {formatWeekday(day)}
                          </span>
                          {windows.length > 0 ? (
                            windows.map((w, i) => (
                              <div
                                key={i}
                                className="text-[11px] font-mono text-spruce-600 dark:text-spruce-400"
                              >
                                {formatMinuteTime(w.startMinute)} – {formatMinuteTime(w.endMinute)}
                              </div>
                            ))
                          ) : (
                            <span className="text-[11px] text-spruce-400">Closed</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-spruce-500 dark:text-spruce-400 italic">
                    Note: Saturday and Sunday are closed. Standard 12:00–13:00 lunch break is excluded from SLA calculations.
                  </p>
                </CardContent>
              </Card>

              {/* 2026 Philippine Holidays Card */}
              <Card className="border-spruce-200 dark:border-spruce-800">
                <CardHeader className="p-4 pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-bold text-spruce-900 dark:text-white">
                        Philippine Official Holidays (Proclamation No. 1006)
                      </CardTitle>
                      <p className="text-xs text-spruce-500 dark:text-spruce-400">
                        Public holidays when business SLA timers are completely suspended.
                      </p>
                    </div>

                    {/* Add Custom Holiday Form */}
                    <form onSubmit={handleAddHoliday} className="flex flex-wrap items-center gap-2">
                      <Input
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        className="text-xs h-8 w-36"
                        required
                      />
                      <Input
                        type="text"
                        placeholder="Holiday Name"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        className="text-xs h-8 w-44"
                        required
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={addHolidayMutation.isPending}
                        className="h-8 text-xs"
                      >
                        Add Holiday
                      </Button>
                    </form>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
                    {(defaultCalendar.holidays || []).map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-spruce-200/80 dark:border-spruce-800 bg-white dark:bg-spruce-950 hover:bg-spruce-50/50 dark:hover:bg-spruce-900/30 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-mono text-[11px] font-bold text-spruce-600 dark:text-spruce-400 block">
                            {holiday.date}
                          </span>
                          <span className="text-xs font-semibold text-spruce-900 dark:text-white truncate block">
                            {holiday.name}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveHoliday(holiday.id)}
                          disabled={removeHolidayMutation.isPending}
                          className="h-7 w-7 p-0 text-spruce-400 hover:text-rose-500 shrink-0"
                          title="Remove holiday"
                        >
                          ✕
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}
