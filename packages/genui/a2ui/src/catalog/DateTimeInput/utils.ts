// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const DAYS_PER_WEEK = 7;
const DATE_TIME_DAYS_PER_MONTH_PAGE = 42;
const DEFAULT_WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export interface DateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface DateTimeInputMode {
  enableDate: boolean;
  enableTime: boolean;
}

export interface DateTimeDayInfo {
  date: Date;
  dateKey: string;
  day: number;
  outside: boolean;
  selected: boolean;
  today: boolean;
  disabled: boolean;
}

export interface DateTimeMonthPage {
  month: Date;
  monthKey: string;
  days: DateTimeDayInfo[];
}

export interface BuildDateTimeMonthPageOptions {
  month: Date;
  selectedDate: Date | null;
  today: Date;
  minDate: Date | null;
  maxDate: Date | null;
  weekStartsOn?: number;
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function pad4(value: number): string {
  if (value < 10) return `000${value}`;
  if (value < 100) return `00${value}`;
  if (value < 1000) return `0${value}`;
  return `${value}`;
}

function createLocalDate(
  year: number,
  month: number,
  day = 1,
  hour = 0,
  minute = 0,
): Date {
  return new Date(year, month, day, hour, minute, 0, 0);
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function daysInMonth(year: number, month: number): number {
  return createLocalDate(year, month, 0).getDate();
}

function isValidDatePart(year: number, month: number, day: number): boolean {
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth(year, month);
}

function isValidTimePart(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function partsFromDate(value: Date): DateTimeParts {
  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
    hour: value.getHours(),
    minute: value.getMinutes(),
  };
}

function parseDateTimeString(value: string): DateTimeParts | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/
    .exec(trimmed);
  if (dateTimeMatch) {
    const [, year, month, day, hour = '0', minute = '0'] = dateTimeMatch;
    const yearValue = Number(year);
    const monthValue = Number(month);
    const dayValue = Number(day);
    const hourValue = Number(hour);
    const minuteValue = Number(minute);
    if (
      !isValidDatePart(yearValue, monthValue, dayValue)
      || !isValidTimePart(hourValue, minuteValue)
    ) {
      return null;
    }
    const date = createLocalDate(
      yearValue,
      monthValue - 1,
      dayValue,
      hourValue,
      minuteValue,
    );
    return isValidDate(date) ? partsFromDate(date) : null;
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(trimmed);
  if (timeMatch) {
    const today = new Date();
    const [, hour, minute] = timeMatch;
    const hourValue = Number(hour);
    const minuteValue = Number(minute);
    if (!isValidTimePart(hourValue, minuteValue)) return null;
    const date = createLocalDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hourValue,
      minuteValue,
    );
    return isValidDate(date) ? partsFromDate(date) : null;
  }

  const date = new Date(trimmed);
  return isValidDate(date) ? partsFromDate(date) : null;
}

export function normalizeDateTimeInputValue(
  value: unknown,
): DateTimeParts | null {
  if (value instanceof Date) {
    return isValidDate(value) ? partsFromDate(value) : null;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return isValidDate(date) ? partsFromDate(date) : null;
  }

  if (typeof value === 'string') {
    return parseDateTimeString(value);
  }

  return null;
}

export function getDefaultDateTimeParts(now = new Date()): DateTimeParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

export function dateTimePartsToDate(parts: DateTimeParts): Date {
  return createLocalDate(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
}

export function dateTimePartsToDateKey(parts: DateTimeParts): string {
  return `${pad4(parts.year)}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function formatDateKey(date: Date): string {
  return [
    pad4(date.getFullYear()),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-');
}

export function formatMonthKey(date: Date): string {
  return `${pad4(date.getFullYear())}-${pad2(date.getMonth() + 1)}`;
}

export function startOfMonth(date: Date): Date {
  return createLocalDate(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, offset: number): Date {
  return createLocalDate(date.getFullYear(), date.getMonth() + offset, 1);
}

export function getWeekdayLabels(
  weekStartsOn = 0,
  labels = DEFAULT_WEEKDAY_LABELS,
): string[] {
  const start = Math.max(0, Math.min(6, Math.floor(weekStartsOn)));
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const weekdayIndex = (start + index) % DAYS_PER_WEEK;
    return labels[weekdayIndex] ?? DEFAULT_WEEKDAY_LABELS[weekdayIndex]!;
  });
}

function compareDateOnly(a: Date, b: Date): number {
  const left = a.getFullYear() * 10000
    + (a.getMonth() + 1) * 100
    + a.getDate();
  const right = b.getFullYear() * 10000
    + (b.getMonth() + 1) * 100
    + b.getDate();
  return left - right;
}

export function compareDateTimeParts(
  a: DateTimeParts,
  b: DateTimeParts,
): number {
  const left = a.year * 100000000
    + a.month * 1000000
    + a.day * 10000
    + a.hour * 100
    + a.minute;
  const right = b.year * 100000000
    + b.month * 1000000
    + b.day * 10000
    + b.hour * 100
    + b.minute;
  return left - right;
}

export function isDateTimeBeforeMin(
  value: DateTimeParts,
  min: DateTimeParts | null,
): boolean {
  return min !== null && compareDateTimeParts(value, min) < 0;
}

export function isDateTimeAfterMax(
  value: DateTimeParts,
  max: DateTimeParts | null,
): boolean {
  return max !== null && compareDateTimeParts(value, max) > 0;
}

export function buildDateTimeMonthPage({
  month,
  selectedDate,
  today,
  minDate,
  maxDate,
  weekStartsOn = 0,
}: BuildDateTimeMonthPageOptions): DateTimeMonthPage {
  const monthStart = startOfMonth(month);
  const normalizedWeekStart = Math.max(
    0,
    Math.min(
      6,
      Math.floor(
        weekStartsOn,
      ),
    ),
  );
  const firstWeekdayOffset =
    (monthStart.getDay() - normalizedWeekStart + DAYS_PER_WEEK)
    % DAYS_PER_WEEK;
  const gridStart = createLocalDate(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - firstWeekdayOffset,
  );
  const selectedDateKey = selectedDate ? formatDateKey(selectedDate) : null;
  const todayKey = formatDateKey(today);

  const days = Array.from(
    { length: DATE_TIME_DAYS_PER_MONTH_PAGE },
    (_, index): DateTimeDayInfo => {
      const date = createLocalDate(
        gridStart.getFullYear(),
        gridStart.getMonth(),
        gridStart.getDate() + index,
      );
      const dateKey = formatDateKey(date);
      const outside = date.getMonth() !== monthStart.getMonth();
      const disabled = (minDate !== null && compareDateOnly(date, minDate) < 0)
        || (maxDate !== null && compareDateOnly(date, maxDate) > 0);

      return {
        date,
        dateKey,
        day: date.getDate(),
        outside,
        selected: dateKey === selectedDateKey,
        today: dateKey === todayKey,
        disabled,
      };
    },
  );

  return {
    month: monthStart,
    monthKey: formatMonthKey(monthStart),
    days,
  };
}

export function normalizeDateTimeInputMode(
  enableDate: unknown,
  enableTime: unknown,
): DateTimeInputMode {
  const date = enableDate !== false;
  const time = enableTime !== false;
  if (!date && !time) {
    return { enableDate: true, enableTime: false };
  }
  return { enableDate: date, enableTime: time };
}

export function normalizeDateTimeInputLabel(value: unknown): string {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

function getDefaultOutputFormat(mode: DateTimeInputMode): string {
  if (!mode.enableDate && mode.enableTime) return 'HH:mm';
  return 'YYYY-MM-DD';
}

export function formatDateTimeInputValue(
  parts: DateTimeParts,
  outputFormat: unknown,
  mode: DateTimeInputMode,
): string {
  const format = typeof outputFormat === 'string' && outputFormat.trim()
    ? outputFormat
    : getDefaultOutputFormat(mode);

  return format
    .replaceAll('YYYY', pad4(parts.year))
    .replaceAll('MM', pad2(parts.month))
    .replaceAll('DD', pad2(parts.day))
    .replaceAll('HH', pad2(parts.hour))
    .replaceAll('mm', pad2(parts.minute));
}

export function getDateTimeInputPlaceholder(mode: DateTimeInputMode): string {
  if (mode.enableDate && mode.enableTime) return 'Select date and time';
  if (mode.enableTime) return 'Select time';
  return 'Select date';
}

export function getDateTimeDialogTitle(
  label: string,
  mode: DateTimeInputMode,
): string {
  return label || getDateTimeInputPlaceholder(mode);
}

export function withDate(
  parts: DateTimeParts,
  date: Date,
): DateTimeParts {
  return {
    ...parts,
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

export function incrementDateTimePart(
  parts: DateTimeParts,
  part: 'hour' | 'minute',
  delta: number,
): DateTimeParts {
  const limit = part === 'hour' ? 24 : 60;
  const current = parts[part];
  const next = ((current + delta) % limit + limit) % limit;
  return {
    ...parts,
    [part]: next,
  };
}
