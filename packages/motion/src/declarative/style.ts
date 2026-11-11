// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MotionValue } from 'motion-dom';

import type { CSSProperties } from '@lynx-js/types';

import type {
  MotionDefinition,
  MotionStyle,
  MotionStyleValue,
  MotionTarget,
  MotionTransition,
  MotionVariants,
} from './types.js';
import { motionValueType } from '../hooks/useMotionValue.js';

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

function resolveStyleValue(value: unknown): unknown {
  const handle = motionValueType.downcast(value);
  if (handle !== undefined) {
    return handle.creationPayload;
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
    if (motionValueType.downcast(value) !== undefined) {
      values[key] = value as MotionValue<string | number>;
    }
  }
  return values;
}

export function motionDefinitionKey(value: unknown): string {
  return JSON.stringify(value) ?? '';
}

export function resolveMotionDefinition(
  definition: MotionDefinition | false | undefined,
  variants: MotionVariants | undefined,
  custom: unknown,
): MotionTarget | false | undefined {
  if (definition === false || definition === undefined) {
    return definition;
  }
  if (typeof definition !== 'string' && !Array.isArray(definition)) {
    return definition;
  }

  const labels = Array.isArray(definition) ? definition : [definition];
  const resolved: MotionTarget = {};
  for (const label of labels) {
    const variant = variants?.[label];
    if (!variant) {
      continue;
    }
    Object.assign(
      resolved,
      typeof variant === 'function' ? variant(custom) : variant,
    );
  }
  return resolved;
}

export function splitMotionTarget(
  definition: MotionTarget | false | undefined,
  fallbackTransition: MotionTransition | undefined,
): {
  target: MotionTarget | undefined;
  transition: MotionTransition | undefined;
} {
  if (!definition) {
    return { target: undefined, transition: fallbackTransition };
  }
  const { transition, ...target } = definition;
  return {
    target: target as MotionTarget,
    transition: transition ?? fallbackTransition,
  };
}
