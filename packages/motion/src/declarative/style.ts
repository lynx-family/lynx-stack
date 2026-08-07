// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue } from 'motion-dom';

import type { CSSProperties } from '@lynx-js/types';

import type { MotionStyle, MotionStyleValue, MotionTarget } from './types.js';

interface MainThreadValueHandle {
  readonly __MAIN_THREAD_VALUE__: true;
  toJSON(): { _initValue: unknown; _wvid: number; _type?: string };
}

const transformAliases: Record<string, string> = {
  x: 'translateX',
  y: 'translateY',
  z: 'translateZ',
  transformPerspective: 'perspective',
};

const transformKeys = new Set([
  'transformPerspective',
  'x',
  'y',
  'z',
  'translateX',
  'translateY',
  'translateZ',
  'scale',
  'scaleX',
  'scaleY',
  'scaleZ',
  'rotate',
  'rotateX',
  'rotateY',
  'rotateZ',
  'skew',
  'skewX',
  'skewY',
]);

function isMainThreadValueHandle(
  value: unknown,
): value is MainThreadValueHandle {
  return value !== null
    && typeof value === 'object'
    && (value as { __MAIN_THREAD_VALUE__?: unknown }).__MAIN_THREAD_VALUE__
      === true;
}

function resolveStyleValue(value: unknown): unknown {
  if (isMainThreadValueHandle(value)) {
    return value.toJSON()._initValue;
  }
  if (Array.isArray(value)) {
    return value.find(item => item !== null && item !== undefined);
  }
  return value;
}

function formatTransformValue(key: string, value: string | number): string {
  if (typeof value === 'string') {
    return value;
  }
  if (key.startsWith('scale')) {
    return String(value);
  }
  if (key.startsWith('rotate') || key.startsWith('skew')) {
    return `${value}deg`;
  }
  return `${value}px`;
}

function appendResolvedValues(
  output: Record<string, unknown>,
  transforms: Record<string, string | number>,
  values: Record<string, unknown>,
): void {
  for (const key in values) {
    const value = resolveStyleValue(values[key]);
    if (value === undefined || value === null) {
      continue;
    }
    if (
      transformKeys.has(key)
      && (typeof value === 'string' || typeof value === 'number')
    ) {
      transforms[key] = value;
    } else {
      output[key] = value;
    }
  }
}

export function resolveInitialStyle(
  style: MotionStyle | string | undefined,
  initial: MotionTarget | false | undefined,
): CSSProperties | string | undefined {
  if (typeof style === 'string') {
    return style;
  }

  const output: Record<string, unknown> = {};
  const transforms: Record<string, string | number> = {};
  appendResolvedValues(
    output,
    transforms,
    (style ?? {}) as Record<string, unknown>,
  );
  if (initial !== false) {
    appendResolvedValues(
      output,
      transforms,
      (initial ?? {}) as Record<string, unknown>,
    );
  }

  const generatedTransform = Object.entries(transforms)
    .map(([key, value]) => {
      const name = transformAliases[key] ?? key;
      return `${name}(${formatTransformValue(key, value)})`;
    })
    .join(' ');
  if (generatedTransform) {
    const existingTransform = output['transform'];
    output['transform'] = typeof existingTransform === 'string'
      ? `${existingTransform} ${generatedTransform}`
      : generatedTransform;
  }

  return Object.keys(output).length > 0 ? output as CSSProperties : undefined;
}

export function resolveInitialValues(
  style: MotionStyle | string | undefined,
  initial: MotionTarget | false | undefined,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (style && typeof style !== 'string') {
    for (const key in style) {
      values[key] = resolveStyleValue(style[key as keyof MotionStyle]);
    }
  }
  if (initial !== false && initial) {
    const initialValues = initial as Record<string, unknown>;
    for (const key in initialValues) {
      values[key] = resolveStyleValue(initialValues[key]);
    }
  }
  return values;
}

export function collectMotionValues(
  style: MotionStyle | string | undefined,
): Record<string, MotionValue<string | number>> {
  if (!style || typeof style === 'string') {
    return {};
  }

  const values: Record<string, MotionValue<string | number>> = {};
  for (const key in style) {
    const value = style[key as keyof MotionStyle] as MotionStyleValue;
    if (isMainThreadValueHandle(value)) {
      values[key] = value as unknown as MotionValue<string | number>;
    }
  }
  return values;
}

export function motionDefinitionKey(value: unknown): string {
  return JSON.stringify(value) ?? '';
}
