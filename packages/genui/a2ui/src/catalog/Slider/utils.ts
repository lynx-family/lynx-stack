// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;

export interface SliderRange {
  min: number;
  max: number;
}

export function normalizeSliderNumber(
  value: unknown,
  fallback: number,
): number {
  const numberValue = typeof value === 'number'
    ? value
    : (typeof value === 'string'
      ? Number(value)
      : Number.NaN);

  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function normalizeSliderRange(
  minValue: unknown,
  maxValue: unknown,
): SliderRange {
  const min = normalizeSliderNumber(minValue, DEFAULT_MIN);
  const max = normalizeSliderNumber(maxValue, DEFAULT_MAX);

  if (max > min) {
    return { min, max };
  }

  return { min: DEFAULT_MIN, max: DEFAULT_MAX };
}

export function clampSliderValue(value: number, range: SliderRange): number {
  return Math.min(Math.max(value, range.min), range.max);
}

export function toSliderRatio(value: unknown, range: SliderRange): number {
  const numericValue = normalizeSliderNumber(value, range.min);
  return (clampSliderValue(numericValue, range) - range.min)
    / (range.max - range.min);
}

export function fromSliderRatio(
  ratio: number,
  range: SliderRange,
  step?: number,
): number {
  const value = clampSliderValue(
    range.min + ratio * (range.max - range.min),
    range,
  );
  if (!step || step <= 0) {
    return trimFloatingPoint(value);
  }
  const stepped = range.min + Math.round((value - range.min) / step) * step;
  return trimFloatingPoint(clampSliderValue(stepped, range));
}

export function toSliderStepRatio(
  step: unknown,
  range: SliderRange,
): number | undefined {
  const stepValue = normalizeSliderNumber(step, Number.NaN);
  if (!Number.isFinite(stepValue) || stepValue <= 0) {
    return undefined;
  }
  return Math.min(stepValue / (range.max - range.min), 1);
}

export function normalizeSliderLabel(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

function trimFloatingPoint(value: number): number {
  return Number(value.toFixed(12));
}
