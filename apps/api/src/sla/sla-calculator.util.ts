export interface WorkingWindowConfig {
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startMinute: number; // minutes from 00:00 (e.g. 480 = 08:00)
  endMinute: number; // minutes from 00:00 (e.g. 720 = 12:00)
}

export interface HolidayConfig {
  date: string; // YYYY-MM-DD
  name?: string;
}

export interface CalendarConfig {
  timezone?: string;
  workingWindows: WorkingWindowConfig[];
  holidays: HolidayConfig[];
}

interface LocalTimeInfo {
  dateStr: string; // YYYY-MM-DD
  weekday: number; // 0-6
  minuteOfDay: number; // 0-1439
  secondOfMinute: number; // 0-59
  millisecond: number; // 0-999
}

function getLocalTimeInfo(date: Date, timezone: string): LocalTimeInfo {
  // Extract parts in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    else if (p.type === 'month') month = p.value;
    else if (p.type === 'day') day = p.value;
    else if (p.type === 'hour') hour = parseInt(p.value, 10);
    else if (p.type === 'minute') minute = parseInt(p.value, 10);
    else if (p.type === 'second') second = parseInt(p.value, 10);
  }

  const dateStr = `${year}-${month}-${day}`;
  // Day of week in target timezone
  // In UTC year-month-day
  const localDateObj = new Date(`${dateStr}T00:00:00Z`);
  const weekday = localDateObj.getUTCDay();

  return {
    dateStr,
    weekday,
    minuteOfDay: hour * 60 + minute,
    secondOfMinute: second,
    millisecond: date.getMilliseconds(),
  };
}

/**
 * Calculates a target SLA due date given a starting date, target minutes, and calendar config.
 */
export function calculateTargetDate(
  startDate: Date,
  targetMinutes: number,
  calendar?: CalendarConfig,
  is24x7 = false,
): Date {
  if (targetMinutes <= 0) {
    return new Date(startDate);
  }

  // If 24/7 or no calendar configuration provided, calculate purely linear minutes
  if (is24x7 || !calendar || !calendar.workingWindows || calendar.workingWindows.length === 0) {
    return new Date(startDate.getTime() + targetMinutes * 60 * 1000);
  }

  const timezone = calendar.timezone || 'Asia/Manila';
  const holidaySet = new Set(calendar.holidays.map((h) => h.date));

  // Sort windows by weekday then startMinute
  const windowsByWeekday = new Map<number, WorkingWindowConfig[]>();
  for (const win of calendar.workingWindows) {
    const list = windowsByWeekday.get(win.weekday) || [];
    list.push(win);
    windowsByWeekday.set(win.weekday, list);
  }
  for (const list of windowsByWeekday.values()) {
    list.sort((a, b) => a.startMinute - b.startMinute);
  }

  let current = new Date(startDate);
  let remainingMinutes = targetMinutes;
  let maxSafetyLoops = 10000; // Prevent infinite loops

  while (remainingMinutes > 0 && maxSafetyLoops-- > 0) {
    const info = getLocalTimeInfo(current, timezone);

    // Check if current day is a holiday
    if (holidaySet.has(info.dateStr)) {
      // Advance to 00:00:00 of the next day
      const nextDayDate = new Date(`${info.dateStr}T00:00:00Z`);
      nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
      // Advance 'current' by the remaining time until next day in milliseconds
      const msUntilMidnight = (24 * 60 - info.minuteOfDay) * 60 * 1000 - info.secondOfMinute * 1000 - info.millisecond;
      current = new Date(current.getTime() + msUntilMidnight);
      continue;
    }

    const dailyWindows = windowsByWeekday.get(info.weekday) || [];
    if (dailyWindows.length === 0) {
      // Weekend or non-working day, advance to midnight of next day
      const msUntilMidnight = (24 * 60 - info.minuteOfDay) * 60 * 1000 - info.secondOfMinute * 1000 - info.millisecond;
      current = new Date(current.getTime() + msUntilMidnight);
      continue;
    }

    // Find the current or next window for today
    let activeWindow: WorkingWindowConfig | null = null;
    let nextWindow: WorkingWindowConfig | null = null;

    for (const win of dailyWindows) {
      if (info.minuteOfDay >= win.startMinute && info.minuteOfDay < win.endMinute) {
        activeWindow = win;
        break;
      } else if (info.minuteOfDay < win.startMinute) {
        nextWindow = win;
        break;
      }
    }

    if (!activeWindow && nextWindow) {
      // Advance current time to the start of the next window today
      const minutesToWait = nextWindow.startMinute - info.minuteOfDay;
      const msToAdvance = minutesToWait * 60 * 1000 - info.secondOfMinute * 1000 - info.millisecond;
      current = new Date(current.getTime() + msToAdvance);
      continue;
    }

    if (!activeWindow && !nextWindow) {
      // Passed all windows for today, advance to midnight of next day
      const msUntilMidnight = (24 * 60 - info.minuteOfDay) * 60 * 1000 - info.secondOfMinute * 1000 - info.millisecond;
      current = new Date(current.getTime() + msUntilMidnight);
      continue;
    }

    if (activeWindow) {
      // We are inside an active window!
      const minutesRemainingInWindow = activeWindow.endMinute - info.minuteOfDay;

      if (remainingMinutes < minutesRemainingInWindow) {
        // We finish in this window!
        return new Date(current.getTime() + remainingMinutes * 60 * 1000);
      } else {
        // Consume whatever is left in this window up to endMinute
        const msUntilWindowEnd = minutesRemainingInWindow * 60 * 1000 - info.secondOfMinute * 1000 - info.millisecond;
        remainingMinutes -= minutesRemainingInWindow;
        current = new Date(current.getTime() + msUntilWindowEnd);
      }
    }
  }

  return current;
}
