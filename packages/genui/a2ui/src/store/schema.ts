// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { Validator } from '@cfworker/json-schema';
import type { Schema } from '@cfworker/json-schema';

/** The v1.0 DynamicBoolean coercion, independent of JavaScript truthiness. */
export function coerceBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return value !== null && typeof value === 'object' && 'valid' in value
    && value.valid === true;
}

/** Coerce dynamic values using their declared catalog type. */
export function coerceDynamic(
  value: unknown,
  schema: Record<string, unknown>,
): unknown {
  const ref = typeof schema['$ref'] === 'string' ? schema['$ref'] : '';
  if (ref.endsWith('/DynamicBoolean')) return coerceBoolean(value);
  if (ref.endsWith('/DynamicString')) {
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return typeof value === 'string' || typeof value === 'number'
        || typeof value === 'boolean'
      ? String(value)
      : '';
  }
  if (ref.endsWith('/DynamicNumber')) {
    if (value == null) return 0;
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }
  if (Array.isArray(value) && schema['items']) {
    return value.map(item =>
      coerceDynamic(item, schema['items'] as Record<string, unknown>)
    );
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema['properties'] as
      | Record<string, Record<string, unknown>>
      | undefined;
    return Object.fromEntries(
      Object.entries(value).map((
        [key, item],
      ) => [
        key,
        properties?.[key] ? coerceDynamic(item, properties[key]) : item,
      ]),
    );
  }
  return value;
}

const validators = new WeakMap<object, Validator>();

/** Argument schemas validate resolved values, never execute wire expressions. */
function resolvedSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => resolvedSchema(item));
  if (value === null || typeof value !== 'object') return value;
  const schema = value as Record<string, unknown>;
  const ref = schema['$ref'];
  if (
    ref === 'common_types.json#/$defs/DataBinding'
    || ref === 'common_types.json#/$defs/FunctionCall'
  ) return false;
  if (
    typeof ref === 'string'
    && ref.startsWith('common_types.json#/$defs/Dynamic')
  ) {
    const type = ref.slice(ref.lastIndexOf('/') + 1);
    if (type === 'DynamicValue') return {};
    if (type === 'DynamicStringList') {
      return { type: 'array', items: { type: 'string' } };
    }
    return { type: type.slice('Dynamic'.length).toLowerCase() };
  }
  return Object.fromEntries(
    Object.entries(schema).map(([key, item]) => [key, resolvedSchema(item)]),
  );
}

/** Validate arguments and apply catalog defaults before local execution or RPC. */
export function validateArguments(
  args: Record<string, unknown>,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = Object.fromEntries(
    Object.entries(args).map((
      [key, value],
    ) => [key, value === undefined ? null : value]),
  );
  const result = coerceDynamic(normalized, schema) as Record<string, unknown>;
  const properties = schema['properties'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  for (const [key, property] of Object.entries(properties ?? {})) {
    if (!(key in result) && 'default' in property) {
      result[key] = property['default'];
    }
  }
  let validator = validators.get(schema);
  if (!validator) {
    validator = new Validator(resolvedSchema(schema) as Schema, '2020-12');
    validators.set(schema, validator);
  }
  const validation = validator.validate(result);
  if (!validation.valid) {
    throw new Error(
      `Invalid function arguments: ${
        validation.errors.map(error => error.error).join('; ')
      }`,
    );
  }
  return result;
}
