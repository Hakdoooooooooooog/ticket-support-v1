import { describe, it, expect } from 'vitest';
import { calculateTargetDate, CalendarConfig } from '../../../src/sla/sla-calculator.util.js';

describe('SlaCalculatorUtil', () => {
  const phCalendar: CalendarConfig = {
    timezone: 'Asia/Manila',
    workingWindows: [
      // Monday (1) to Friday (5): 08:00 - 12:00 (480 - 720) and 13:00 - 17:00 (780 - 1020)
      { weekday: 1, startMinute: 480, endMinute: 720 },
      { weekday: 1, startMinute: 780, endMinute: 1020 },
      { weekday: 2, startMinute: 480, endMinute: 720 },
      { weekday: 2, startMinute: 780, endMinute: 1020 },
      { weekday: 3, startMinute: 480, endMinute: 720 },
      { weekday: 3, startMinute: 780, endMinute: 1020 },
      { weekday: 4, startMinute: 480, endMinute: 720 },
      { weekday: 4, startMinute: 780, endMinute: 1020 },
      { weekday: 5, startMinute: 480, endMinute: 720 },
      { weekday: 5, startMinute: 780, endMinute: 1020 },
    ],
    holidays: [
      { date: '2026-05-01', name: 'Labor Day' },
      { date: '2026-06-12', name: 'Independence Day' },
    ],
  };

  it('calculates 24/7 SLAs by adding calendar minutes directly', () => {
    // 2026-05-04 09:00:00 UTC (which is 17:00 in Manila)
    const start = new Date('2026-05-04T09:00:00.000Z');
    const result = calculateTargetDate(start, 30, phCalendar, true);
    expect(result.toISOString()).toBe('2026-05-04T09:30:00.000Z');
  });

  it('adds minutes within the same morning window', () => {
    // Monday 2026-05-04 at 09:00 Manila time is 2026-05-04 01:00 UTC
    const start = new Date('2026-05-04T01:00:00.000Z');
    // Add 60 minutes -> 10:00 Manila time (02:00 UTC)
    const result = calculateTargetDate(start, 60, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-04T02:00:00.000Z');
  });

  it('skips lunch break (12:00 to 13:00 Manila time)', () => {
    // Monday 2026-05-04 at 11:30 Manila time (03:30 UTC)
    const start = new Date('2026-05-04T03:30:00.000Z');
    // Add 60 minutes -> 30 min morning (reaches 12:00), lunch skipped, 30 min afternoon (reaches 13:30 Manila / 05:30 UTC)
    const result = calculateTargetDate(start, 60, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-04T05:30:00.000Z');
  });

  it('advances start time to opening hours if submitted before business hours', () => {
    // Monday 2026-05-04 at 06:30 Manila time (2026-05-03 22:30 UTC)
    const start = new Date('2026-05-03T22:30:00.000Z');
    // Should start at 08:00 Manila (00:00 UTC) + 60 minutes = 09:00 Manila (01:00 UTC)
    const result = calculateTargetDate(start, 60, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-04T01:00:00.000Z');
  });

  it('spans across overnight into next business day', () => {
    // Monday 2026-05-04 at 16:00 Manila time (08:00 UTC)
    const start = new Date('2026-05-04T08:00:00.000Z');
    // 120 minutes -> 60 min to 17:00, then 60 min Tuesday morning (08:00-09:00 Manila / 01:00 UTC)
    const result = calculateTargetDate(start, 120, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-05T01:00:00.000Z');
  });

  it('spans across weekend (Friday afternoon to Monday morning)', () => {
    // Friday 2026-05-08 at 16:30 Manila time (08:30 UTC)
    const start = new Date('2026-05-08T08:30:00.000Z');
    // 60 minutes -> 30 min Friday (to 17:00), weekend skipped, 30 min Monday morning (08:00 to 08:30 Manila / 00:30 UTC)
    const result = calculateTargetDate(start, 60, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-11T00:30:00.000Z');
  });

  it('skips public holidays (e.g. Labor Day 2026-05-01 Friday)', () => {
    // Thursday 2026-04-30 at 16:00 Manila time (08:00 UTC)
    const start = new Date('2026-04-30T08:00:00.000Z');
    // 120 minutes:
    // Thursday: 60 min (16:00 -> 17:00)
    // Friday 2026-05-01 is Labor Day (skipped!)
    // Saturday & Sunday (skipped!)
    // Monday 2026-05-04: remaining 60 min -> 08:00 to 09:00 Manila (01:00 UTC)
    const result = calculateTargetDate(start, 120, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-04T01:00:00.000Z');
  });

  it('spans multiple business days (24 business hours = 3 full days of 8 hours)', () => {
    // Monday 2026-05-04 08:00 Manila (00:00 UTC)
    const start = new Date('2026-05-04T00:00:00.000Z');
    // 24 hours * 60 min = 1440 min
    // Mon 8h + Tue 8h + Wed 8h = ends Wednesday 17:00 Manila (09:00 UTC)
    const result = calculateTargetDate(start, 1440, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-06T09:00:00.000Z');
  });

  it('lands exactly on a window boundary without overflowing', () => {
    // Monday 2026-05-04 10:00 Manila (02:00 UTC)
    const start = new Date('2026-05-04T02:00:00.000Z');
    // Exactly 120 minutes to lunch (12:00 Manila / 04:00 UTC)
    const result = calculateTargetDate(start, 120, phCalendar, false);
    expect(result.toISOString()).toBe('2026-05-04T04:00:00.000Z');
  });
});
