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
import {
  getMotionValueHandleInitialValue,
  isMotionValueHandle,
} from '../hooks/useMotionValue.js';

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

function resolveStyleValue(
  value: unknown,
  useFinalKeyframe = false,
): unknown {
  if (isMotionValueHandle(value)) {
    return getMotionValueHandleInitialValue(value);
  }
  if (Array.isArray(value)) {
    if (useFinalKeyframe) {
      for (let index = value.length - 1; index >= 0; index--) {
        if (value[index] !== null && value[index] !== undefined) {
          return value[index];
        }
      }
      return undefined;
    }
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

function formatTransformOriginValue(
  key: 'originX' | 'originY' | 'originZ',
  value: string | number,
): string {
  if (typeof value === 'string') {
    return value;
  }
  return key === 'originZ' ? `${value}px` : `${value * 100}%`;
}

function appendResolvedValues(
  output: Record<string, unknown>,
  transforms: Record<string, string | number>,
  values: Record<string, unknown>,
  useFinalKeyframe = false,
): void {
  for (const key in values) {
    const value = resolveStyleValue(values[key], useFinalKeyframe);
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
  animate?: MotionTarget,
): CSSProperties | string | undefined {
  if (typeof style === 'string') {
    return style;
  }

  const output: Record<string, unknown> = {};
  const transforms: Record<string, string | number> = {};
  const transformOrigin: Partial<
    Record<'originX' | 'originY' | 'originZ', string | number>
  > = {};
  const appendInitialValues = (
    values: Record<string, unknown>,
    useFinalKeyframe = false,
  ) => {
    const { originX, originY, originZ, ...rest } = values;
    appendResolvedValues(output, transforms, rest, useFinalKeyframe);
    for (const [key, value] of Object.entries({ originX, originY, originZ })) {
      const resolvedValue = resolveStyleValue(value, useFinalKeyframe);
      if (
        typeof resolvedValue === 'string'
        || typeof resolvedValue === 'number'
      ) {
        transformOrigin[key as keyof typeof transformOrigin] = resolvedValue;
      }
    }
  };
  appendInitialValues((style ?? {}) as Record<string, unknown>);
  if (initial === false) {
    appendInitialValues((animate ?? {}) as Record<string, unknown>, true);
  } else {
    appendInitialValues((initial ?? {}) as Record<string, unknown>);
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
  if (Object.keys(transformOrigin).length > 0) {
    const originX = transformOrigin.originX ?? '50%';
    const originY = transformOrigin.originY ?? '50%';
    const originZ = transformOrigin.originZ ?? '0';
    output['transformOrigin'] = [
      formatTransformOriginValue('originX', originX),
      formatTransformOriginValue('originY', originY),
      formatTransformOriginValue('originZ', originZ),
    ].join(' ');
  }

  return Object.keys(output).length > 0 ? output as CSSProperties : undefined;
}

export function resolveInitialValues(
  style: MotionStyle | string | undefined,
  initial: MotionTarget | false | undefined,
  animate?: MotionTarget,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (style && typeof style !== 'string') {
    for (const key in style) {
      values[key] = resolveStyleValue(style[key as keyof MotionStyle]);
    }
  }
  if (initial === false && animate) {
    const animateValues = animate as Record<string, unknown>;
    for (const key in animateValues) {
      values[key] = resolveStyleValue(animateValues[key], true);
    }
  } else if (initial) {
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
    if (isMotionValueHandle(value)) {
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
  transitionEnd: Record<string, unknown> | undefined;
} {
  if (!definition) {
    return {
      target: undefined,
      transition: fallbackTransition,
      transitionEnd: undefined,
    };
  }
  const { transition, transitionEnd, ...target } = definition;
  return {
    target: target as MotionTarget,
    transition: transition ?? fallbackTransition,
    transitionEnd,
  };
}
