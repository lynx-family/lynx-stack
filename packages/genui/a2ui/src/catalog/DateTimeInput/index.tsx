// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  DialogBackdrop,
  DialogContent,
  DialogRoot,
  DialogView,
} from '@lynx-js/lynx-ui';
import { useEffect, useState } from '@lynx-js/react';

import {
  addMonths,
  buildDateTimeMonthPage,
  dateTimePartsToDate,
  formatDateTimeInputValue,
  getDateTimeInputPlaceholder,
  getDefaultDateTimeParts,
  getWeekdayLabels,
  incrementDateTimePart,
  isDateTimeAfterMax,
  isDateTimeBeforeMin,
  normalizeDateTimeInputLabel,
  normalizeDateTimeInputMode,
  normalizeDateTimeInputValue,
  startOfMonth,
  withDate,
} from './utils.js';
import { useChecks } from '../../react/useChecks.js';
import type { CheckLike } from '../../react/useChecks.js';
import type { GenericComponentProps } from '../../store/types.js';

import '../../../styles/catalog/DateTimeInput.css';

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatMonthCaption(month: Date): string {
  return `${MONTH_LABELS[month.getMonth()]} ${month.getFullYear()}`;
}

function joinClassNames(values: Array<string | false | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function getPartsKey(parts: ReturnType<typeof normalizeDateTimeInputValue>) {
  return parts
    ? formatDateTimeInputValue(
      parts,
      'YYYY-MM-DD HH:mm',
      { enableDate: true, enableTime: true },
    )
    : '';
}

/**
 * @a2uiCatalog DateTimeInput
 */
export interface DateTimeInputProps extends GenericComponentProps {
  /** The current date/time value. Typically bound to a data path. */
  value: string | { path: string };
  /** The text label for the input field. */
  label?: string | { path: string } | {
    call: string;
    args: Record<string, unknown>;
    returnType?:
      | 'string'
      | 'number'
      | 'boolean'
      | 'array'
      | 'object'
      | 'any'
      | 'void';
  };
  /** Whether to show the date picker. */
  enableDate?: boolean;
  /** Whether to show the time picker. */
  enableTime?: boolean;
  /** Format string for the output value. Supports YYYY, MM, DD, HH, and mm. */
  outputFormat?: string;
  /** Minimum allowed date/time value. */
  min?: string;
  /** Maximum allowed date/time value. */
  max?: string;
  /** A list of checks to perform. */
  checks?: Array<{
    /** The condition that indicates whether the check passes. */
    condition: boolean | { path: string } | {
      call: string;
      args: Record<string, unknown>;
      returnType?:
        | 'string'
        | 'number'
        | 'boolean'
        | 'array'
        | 'object'
        | 'any'
        | 'void';
    };
    /** The error message to display if the check fails. */
    message: string;
  }>;
}

export function DateTimeInput(
  props: DateTimeInputProps,
): import('@lynx-js/react').ReactNode {
  const {
    dataContextPath,
    id,
    label,
    max,
    min,
    outputFormat,
    setValue,
    surface,
  } = props;
  const mode = normalizeDateTimeInputMode(props.enableDate, props.enableTime);
  const valueParts = normalizeDateTimeInputValue(props.value);
  const minParts = normalizeDateTimeInputValue(min);
  const maxParts = normalizeDateTimeInputValue(max);
  const valueKey = getPartsKey(valueParts);
  const initialParts = valueParts ?? getDefaultDateTimeParts();
  const [open, setOpen] = useState(false);
  const [draftParts, setDraftParts] = useState(initialParts);
  const [visibleMonth, setVisibleMonth] = useState(
    startOfMonth(dateTimePartsToDate(initialParts)),
  );
  const checks = props.checks as CheckLike[] | undefined;

  const { ok, firstFailureMessage } = useChecks({
    checks,
    componentId: id ?? '',
    surface,
    dataContextPath,
  });

  useEffect(() => {
    if (open) return undefined;
    const nextParts = valueParts ?? getDefaultDateTimeParts();
    setDraftParts(nextParts);
    setVisibleMonth(startOfMonth(dateTimePartsToDate(nextParts)));
    return undefined;
  }, [open, valueKey]);

  const minDate = minParts ? dateTimePartsToDate(minParts) : null;
  const maxDate = maxParts ? dateTimePartsToDate(maxParts) : null;
  const draftDate = dateTimePartsToDate(draftParts);
  const monthPage = buildDateTimeMonthPage({
    month: visibleMonth,
    selectedDate: draftDate,
    today: new Date(),
    minDate,
    maxDate,
  });
  const weekdayLabels = getWeekdayLabels();
  const draftOutOfRange = isDateTimeBeforeMin(draftParts, minParts)
    || isDateTimeAfterMax(draftParts, maxParts);
  const currentOutOfRange = valueParts
    ? isDateTimeBeforeMin(valueParts, minParts)
      || isDateTimeAfterMax(valueParts, maxParts)
    : false;
  const invalid = !ok || currentOutOfRange;
  const labelText = normalizeDateTimeInputLabel(label);
  const displayValue = valueParts
    ? formatDateTimeInputValue(valueParts, outputFormat, mode)
    : getDateTimeInputPlaceholder(mode);

  const handleOpen = () => {
    const nextParts = valueParts ?? draftParts ?? getDefaultDateTimeParts();
    setDraftParts(nextParts);
    setVisibleMonth(startOfMonth(dateTimePartsToDate(nextParts)));
    setOpen(true);
  };

  const handleCancel = () => {
    setOpen(false);
  };

  const handleConfirm = () => {
    if (draftOutOfRange) return;
    setValue?.(
      'value',
      formatDateTimeInputValue(draftParts, outputFormat, mode),
    );
    setOpen(false);
  };

  const handlePreviousMonth = () => {
    setVisibleMonth(addMonths(visibleMonth, -1));
  };

  const handleNextMonth = () => {
    setVisibleMonth(addMonths(visibleMonth, 1));
  };

  const handleTimeStep = (part: 'hour' | 'minute', delta: number) => {
    setDraftParts((current) => incrementDateTimePart(current, part, delta));
  };

  const rootClassName = joinClassNames([
    'datetime-input',
    invalid && 'datetime-input-invalid',
  ]);

  return (
    <view key={id} className={rootClassName}>
      {labelText
        ? <text className='datetime-input-label'>{labelText}</text>
        : null}
      <view
        className={joinClassNames([
          'datetime-input-control',
          !valueParts && 'datetime-input-control-placeholder',
        ])}
        bindtap={handleOpen}
        event-through={false}
      >
        <text className='datetime-input-value'>{displayValue}</text>
        <text className='datetime-input-icon'>calendar_today</text>
      </view>
      {invalid && firstFailureMessage
        ? <text className='datetime-input-error'>{firstFailureMessage}</text>
        : null}
      {currentOutOfRange
        ? <text className='datetime-input-error'>Date is out of range</text>
        : null}

      <DialogRoot
        show={open}
        onShowChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
        <DialogView className='datetime-dialog-view' overlayLevel={4}>
          <DialogBackdrop
            className='datetime-dialog-backdrop'
            clickToClose={true}
            transition={true}
          />
          <DialogContent className='datetime-dialog-content' transition={true}>
            {mode.enableDate
              ? (
                <view className='datetime-calendar'>
                  <view className='datetime-calendar-header'>
                    <view
                      className='datetime-calendar-nav'
                      bindtap={handlePreviousMonth}
                      event-through={false}
                    >
                      <text className='datetime-calendar-nav-icon'>
                        chevron_left
                      </text>
                    </view>
                    <text className='datetime-calendar-caption'>
                      {formatMonthCaption(visibleMonth)}
                    </text>
                    <view
                      className='datetime-calendar-nav'
                      bindtap={handleNextMonth}
                      event-through={false}
                    >
                      <text className='datetime-calendar-nav-icon'>
                        chevron_right
                      </text>
                    </view>
                  </view>

                  <view className='datetime-weekdays'>
                    {weekdayLabels.map((weekday, weekdayIndex) => (
                      <view
                        key={weekdayIndex}
                        className='datetime-weekday'
                      >
                        <text className='datetime-weekday-text'>
                          {weekday}
                        </text>
                      </view>
                    ))}
                  </view>

                  <view className='datetime-month'>
                    {monthPage.days.map((day, dayIndex) => (
                      <view
                        key={dayIndex}
                        className={joinClassNames([
                          'datetime-day',
                          day.outside && 'datetime-day-outside',
                          day.selected && 'datetime-day-selected',
                          day.today && 'datetime-day-today',
                          day.disabled && 'datetime-day-disabled',
                        ])}
                        bindtap={() => {
                          if (day.disabled) return;
                          setDraftParts((current) =>
                            withDate(current, day.date)
                          );
                          if (day.outside) {
                            setVisibleMonth(startOfMonth(day.date));
                          }
                        }}
                        event-through={false}
                      >
                        <text className='datetime-day-text'>
                          {String(day.day)}
                        </text>
                      </view>
                    ))}
                  </view>
                </view>
              )
              : null}

            {mode.enableTime
              ? (
                <view className='datetime-time'>
                  <text className='datetime-time-label'>Time</text>
                  <view className='datetime-time-fields'>
                    <view className='datetime-time-field'>
                      <view
                        className='datetime-time-stepper'
                        bindtap={() => handleTimeStep('hour', 1)}
                        event-through={false}
                      >
                        <text className='datetime-time-stepper-icon'>
                          expand_less
                        </text>
                      </view>
                      <text className='datetime-time-value'>
                        {String(draftParts.hour).padStart(2, '0')}
                      </text>
                      <view
                        className='datetime-time-stepper'
                        bindtap={() => handleTimeStep('hour', -1)}
                        event-through={false}
                      >
                        <text className='datetime-time-stepper-icon'>
                          expand_more
                        </text>
                      </view>
                    </view>
                    <text className='datetime-time-separator'>:</text>
                    <view className='datetime-time-field'>
                      <view
                        className='datetime-time-stepper'
                        bindtap={() => handleTimeStep('minute', 1)}
                        event-through={false}
                      >
                        <text className='datetime-time-stepper-icon'>
                          expand_less
                        </text>
                      </view>
                      <text className='datetime-time-value'>
                        {String(draftParts.minute).padStart(2, '0')}
                      </text>
                      <view
                        className='datetime-time-stepper'
                        bindtap={() => handleTimeStep('minute', -1)}
                        event-through={false}
                      >
                        <text className='datetime-time-stepper-icon'>
                          expand_more
                        </text>
                      </view>
                    </view>
                  </view>
                </view>
              )
              : null}

            {draftOutOfRange
              ? (
                <text className='datetime-dialog-error'>
                  Date is out of range
                </text>
              )
              : null}

            <view className='datetime-dialog-actions'>
              <view
                className='datetime-dialog-button datetime-dialog-button-secondary'
                bindtap={handleCancel}
                event-through={false}
              >
                <text className='datetime-dialog-button-text-secondary'>
                  Cancel
                </text>
              </view>
              <view
                className={joinClassNames([
                  'datetime-dialog-button',
                  'datetime-dialog-button-primary',
                  draftOutOfRange && 'datetime-dialog-button-disabled',
                ])}
                bindtap={handleConfirm}
                event-through={false}
              >
                <text className='datetime-dialog-button-text-primary'>
                  Done
                </text>
              </view>
            </view>
          </DialogContent>
        </DialogView>
      </DialogRoot>
    </view>
  );
}
