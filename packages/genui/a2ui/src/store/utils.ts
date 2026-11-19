// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { DataBinding, ProtocolFunctionCall } from './types.js';

/**
 * Return whether a value is a non-array object record.
 *
 * @internal
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Compare JSON containers by shape and the identity of their children. */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  return isObject(a) && isObject(b) && equalEntries(a, b, Object.is);
}

/** Compare resolved JSON data without interpreting directive-like keys. */
export function equalJsonValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  const prototype: unknown = Object.getPrototypeOf(a);
  if (prototype !== Object.getPrototypeOf(b)) return false;
  if (
    !Array.isArray(a) && prototype !== Object.prototype && prototype !== null
  ) return false;
  return equalEntries(a, b, equalJsonValues);
}

function equalEntries(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  equalValue: (a: unknown, b: unknown) => boolean,
): boolean {
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && a.length !== b['length']) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length
    && keys.every(key =>
      Object.prototype.hasOwnProperty.call(b, key) && equalValue(a[key], b[key])
    );
}

/**
 * Return whether a value matches the A2UI data-binding shape.
 */
export function isDataBinding(value: unknown): value is DataBinding {
  return isObject(value) && typeof value['@path'] === 'string';
}

/**
 * Return whether a value matches the A2UI function-call shape.
 */
export function isFunctionCall(value: unknown): value is ProtocolFunctionCall {
  return isObject(value) && typeof value['@call'] === 'string';
}

/**
 * Return whether a value is any call-expression-like dynamic object.
 *
 * @internal
 */
export function isCallExpression(value: unknown): boolean {
  return isFunctionCall(value);
}

/**
 * Return whether a value describes a templated children binding.
 *
 * @internal
 */
export function isTemplateBinding(value: unknown): boolean {
  return isObject(value) && typeof value['path'] === 'string'
    && typeof value['componentId'] === 'string';
}

/**
 * Return whether a value is a data binding without template metadata.
 *
 * @internal
 */
export function isPlainDataBinding(value: unknown): boolean {
  return isDataBinding(value) && !('componentId' in value);
}
