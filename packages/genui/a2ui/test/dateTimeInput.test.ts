// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from '@rstest/core';

import {
  buildDateTimeMonthPage,
  compareDateTimeParts,
  formatDateTimeInputValue,
  getDateTimeInputPlaceholder,
  getWeekdayLabels,
  incrementDateTimePart,
  normalizeDateTimeInputLabel,
  normalizeDateTimeInputMode,
  normalizeDateTimeInputValue,
} from '../src/catalog/DateTimeInput/utils.js';

describe('DateTimeInput utils', () => {
  test('parses date-only values as local calendar parts', () => {
    expect(normalizeDateTimeInputValue('2026-05-26')).toEqual({
      year: 2026,
      month: 5,
      day: 26,
      hour: 0,
      minute: 0,
    });
  });

  test('parses local date-time values', () => {
    expect(normalizeDateTimeInputValue('2026-05-26 09:30')).toEqual({
      year: 2026,
      month: 5,
      day: 26,
      hour: 9,
      minute: 30,
    });
    expect(normalizeDateTimeInputValue('2026-05-26T09:30')).toEqual({
      year: 2026,
      month: 5,
      day: 26,
      hour: 9,
      minute: 30,
    });
  });

  test('ignores unsupported values', () => {
    expect(normalizeDateTimeInputValue(undefined)).toBeNull();
    expect(normalizeDateTimeInputValue('bad')).toBeNull();
    expect(normalizeDateTimeInputValue({ path: '/date' })).toBeNull();
  });

  test('normalizes modes with a usable fallback', () => {
    expect(normalizeDateTimeInputMode(undefined, undefined)).toEqual({
      enableDate: true,
      enableTime: true,
    });
    expect(normalizeDateTimeInputMode(true, false)).toEqual({
      enableDate: true,
      enableTime: false,
    });
    expect(normalizeDateTimeInputMode(false, false)).toEqual({
      enableDate: true,
      enableTime: false,
    });
  });

  test('formats output values', () => {
    const parts = {
      year: 2026,
      month: 5,
      day: 26,
      hour: 9,
      minute: 7,
    };
    expect(
      formatDateTimeInputValue(
        parts,
        undefined,
        { enableDate: true, enableTime: true },
      ),
    ).toBe('2026-05-26');
    expect(
      formatDateTimeInputValue(
        parts,
        'YYYY-MM-DD HH:mm',
        { enableDate: true, enableTime: true },
      ),
    ).toBe('2026-05-26 09:07');
    expect(
      formatDateTimeInputValue(
        parts,
        undefined,
        { enableDate: false, enableTime: true },
      ),
    ).toBe('09:07');
  });

  test('builds a six-week month page so long months are complete', () => {
    const page = buildDateTimeMonthPage({
      month: new Date(2026, 7, 1),
      selectedDate: new Date(2026, 7, 31),
      today: new Date(2026, 7, 2),
      minDate: null,
      maxDate: null,
    });

    expect(page.days).toHaveLength(42);
    expect(page.days.some((day) => day.dateKey === '2026-08-31')).toBe(true);
    expect(
      page.days.find((day) => day.dateKey === '2026-08-31')?.selected,
    ).toBe(true);
  });

  test('marks days outside min and max as disabled', () => {
    const page = buildDateTimeMonthPage({
      month: new Date(2026, 4, 1),
      selectedDate: null,
      today: new Date(2026, 4, 1),
      minDate: new Date(2026, 4, 10),
      maxDate: new Date(2026, 4, 20),
    });

    expect(page.days.find((day) => day.dateKey === '2026-05-09')?.disabled)
      .toBe(true);
    expect(page.days.find((day) => day.dateKey === '2026-05-10')?.disabled)
      .toBe(false);
    expect(page.days.find((day) => day.dateKey === '2026-05-21')?.disabled)
      .toBe(true);
  });

  test('compares date-time parts and wraps time stepping', () => {
    expect(
      compareDateTimeParts(
        { year: 2026, month: 5, day: 26, hour: 9, minute: 30 },
        { year: 2026, month: 5, day: 26, hour: 9, minute: 31 },
      ),
    ).toBeLessThan(0);
    expect(
      incrementDateTimePart(
        { year: 2026, month: 5, day: 26, hour: 23, minute: 59 },
        'hour',
        1,
      ).hour,
    ).toBe(0);
    expect(
      incrementDateTimePart(
        { year: 2026, month: 5, day: 26, hour: 23, minute: 59 },
        'minute',
        1,
      ).minute,
    ).toBe(0);
  });

  test('normalizes labels, placeholders, and weekday labels', () => {
    expect(normalizeDateTimeInputLabel('Due')).toBe('Due');
    expect(normalizeDateTimeInputLabel(7)).toBe('7');
    expect(normalizeDateTimeInputLabel({ path: '/label' })).toBe('');
    expect(
      getDateTimeInputPlaceholder({ enableDate: true, enableTime: true }),
    ).toBe('Select date and time');
    expect(getWeekdayLabels(1)).toEqual([
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
      'Su',
    ]);
  });
});
