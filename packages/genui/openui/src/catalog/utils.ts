// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

export const GAP_CLASS: Record<string, string> = {
  none: 'OpenUIGapNone',
  xs: 'OpenUIGapXs',
  s: 'OpenUIGapS',
  m: 'OpenUIGapM',
  l: 'OpenUIGapL',
  xl: 'OpenUIGapXl',
};

export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export const pathBindingSchema = z.object({
  path: z.string(),
});

export const stringLikeSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  pathBindingSchema,
]);

export const booleanLikeSchema = z.union([
  z.boolean(),
  pathBindingSchema,
]);

export const templateChildrenSchema = z.object({
  componentId: z.string(),
  path: z.string(),
});

export type StringLike = z.infer<typeof stringLikeSchema>;

export function isPathBinding(value: unknown): value is { path: string } {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { path?: unknown }).path === 'string'
  );
}

export function isTemplateChildren(
  value: unknown,
): value is { componentId: string; path: string } {
  return (
    typeof value === 'object'
    && value !== null
    && typeof (value as { componentId?: unknown }).componentId === 'string'
    && typeof (value as { path?: unknown }).path === 'string'
  );
}

export function stringifyValue(value: unknown): string {
  if (isPathBinding(value)) return `{path: ${value.path}}`;
  if (
    typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '';
}

export function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

export function getAlignClass(
  align: 'start' | 'center' | 'end' | 'stretch' | undefined,
): string {
  switch (align) {
    case 'start':
      return 'OpenUIAlignStart';
    case 'center':
      return 'OpenUIAlignCenter';
    case 'end':
      return 'OpenUIAlignEnd';
    default:
      return 'OpenUIAlignStretch';
  }
}

export function getJustifyClass(
  justify:
    | 'start'
    | 'center'
    | 'end'
    | 'between'
    | 'around'
    | 'evenly'
    | 'spaceBetween'
    | 'spaceAround'
    | 'spaceEvenly'
    | 'stretch'
    | undefined,
): string {
  switch (justify) {
    case 'center':
      return 'OpenUIJustifyCenter';
    case 'end':
      return 'OpenUIJustifyEnd';
    case 'between':
    case 'spaceBetween':
      return 'OpenUIJustifyBetween';
    case 'around':
    case 'spaceAround':
      return 'OpenUIJustifyAround';
    case 'evenly':
    case 'spaceEvenly':
      return 'OpenUIJustifyEvenly';
    case 'stretch':
      return 'OpenUIJustifyStretch';
    default:
      return 'OpenUIJustifyStart';
  }
}
