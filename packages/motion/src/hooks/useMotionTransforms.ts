// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue, SpringOptions } from 'motion-dom';

import {
  readInitialMotionInput,
  useDerivedMotionValue,
} from './useDerivedMotionValue.js';
import type { MotionInput, MotionScalar } from './useDerivedMotionValue.js';
import { transform } from '../upstream/values.js';

/** Options for a range-based ReactLynx MotionValue transform. */
export interface MotionTransformOptions {
  /** Clamp the result to the output range. Defaults to true. */
  clamp?: boolean;
}

type RangeOutput<T extends MotionScalar> = T extends number ? number : string;

/** Map a MotionValue through an input range and an output range. */
export function useTransform<T extends MotionScalar>(
  source: MotionValue<number>,
  inputRange: readonly number[],
  outputRange: readonly T[],
  { clamp = true }: MotionTransformOptions = {},
): MotionValue<RangeOutput<T>> {
  const input = [...inputRange];
  const output = [...outputRange];
  const initial = transform(
    readInitialMotionInput(source) as number,
    input,
    output,
    { clamp },
  );

  return useDerivedMotionValue(initial as RangeOutput<T>, {
    kind: 'map',
    source,
    input,
    output,
    clamp,
  });
}

/** Follow a number or string MotionValue with a main-thread spring. */
export function useSpring(
  source: number | MotionValue<number>,
  options?: SpringOptions,
): MotionValue<number>;
export function useSpring(
  source: string | MotionValue<string>,
  options?: SpringOptions,
): MotionValue<string>;
export function useSpring(
  source: MotionInput,
  options: SpringOptions = {},
): MotionValue<number> | MotionValue<string> | MotionValue<MotionScalar> {
  return useDerivedMotionValue(readInitialMotionInput(source), {
    kind: 'spring',
    source,
    options,
  });
}

/** Compose a string from literals and live main-thread MotionValues. */
export function useMotionTemplate(
  template: TemplateStringsArray,
  ...values: MotionInput[]
): MotionValue<string> {
  const fragments = [...template];
  const initial = fragments.map((fragment, index) =>
    fragment + readInitialMotionInput(values[index] ?? '')
  ).join('');

  return useDerivedMotionValue(initial, {
    kind: 'template',
    fragments,
    values,
  });
}
