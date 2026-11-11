// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import functionSchemas from './basic-functions.json' with { type: 'json' };
import { extraFunctions } from './extraFunctions.js';
import { formatString } from './formatString.js';
import { MAX_REGEX_VALUE_CODE_POINTS, analyzeRegex } from './regexSubset.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';
import { functionRegistry } from '../store/FunctionRegistry.js';
import type {
  FunctionDefinition,
  FunctionImpl,
} from '../store/FunctionRegistry.js';
import { coerceBoolean, validateArguments } from '../store/schema.js';

function regex(pattern: string, value: string): { valid: boolean } {
  const analysis = analyzeRegex(pattern);
  if (!analysis.ok) throw new Error(analysis.detail);
  if ([...value].length > MAX_REGEX_VALUE_CODE_POINTS) return { valid: false };
  let normalized = '';
  let escaped = false;
  let inClass = false;
  for (const char of pattern) {
    if (escaped) {
      normalized += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      normalized += char;
      escaped = true;
      continue;
    }
    if (char === '[') inClass = true;
    if (char === ']') inClass = false;
    normalized += char === '$' && !inClass ? '(?![\\s\\S])' : char;
  }
  return { valid: new RegExp(normalized, 'u').test(value) };
}

function formatDate(value: unknown, pattern: string): string {
  const input = typeof value === 'string' ? value : '';
  const instant = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/.test(input) ? input : `${input}Z`,
  );
  if (Number.isNaN(instant.getTime())) return '';

  // Preserve the timestamp's written wall-clock fields across host time zones.
  const wallClock = input.replace(/(?:Z|[+-]\d{2}:?\d{2})$/, '').replace(
    ' ',
    'T',
  );
  const date = new Date(
    `${wallClock.includes('T') ? wallClock : wallClock + 'T00:00:00'}Z`,
  );
  if (Number.isNaN(date.getTime())) return '';
  const fields = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (
    !fields || Number(fields[1]) !== date.getUTCFullYear()
    || Number(fields[2]) !== date.getUTCMonth() + 1
    || Number(fields[3]) !== date.getUTCDate()
  ) return '';
  if (pattern === 'ISO') return instant.toISOString();
  const named = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(
      date,
    );
  const hours = date.getUTCHours();
  const tokens: Record<string, string | number> = {
    yyyy: date.getUTCFullYear(),
    yy: String(date.getUTCFullYear()).slice(-2),
    MMMM: named({ month: 'long' }),
    MMM: named({ month: 'short' }),
    MM: String(date.getUTCMonth() + 1).padStart(2, '0'),
    M: date.getUTCMonth() + 1,
    dd: String(date.getUTCDate()).padStart(2, '0'),
    d: date.getUTCDate(),
    EEEE: named({ weekday: 'long' }),
    E: named({ weekday: 'short' }),
    HH: String(hours).padStart(2, '0'),
    H: hours,
    hh: String(hours % 12 || 12).padStart(2, '0'),
    h: hours % 12 || 12,
    mm: String(date.getUTCMinutes()).padStart(2, '0'),
    ss: String(date.getUTCSeconds()).padStart(2, '0'),
    a: hours < 12 ? 'AM' : 'PM',
  };
  return pattern.replace(
    /yyyy|MMMM|EEEE|MMM|yy|MM|dd|HH|hh|mm|ss|[MdEHha]/g,
    token => String(tokens[token]),
  );
}

const implementations: Record<string, FunctionImpl> = {
  required: ({ value }) => ({
    valid: value != null && value !== ''
      && (!Array.isArray(value) || value.length > 0),
  }),
  regex: args => regex(args['pattern'] as string, args['value'] as string),
  length: ({ value, min, max }) => {
    const length = String(value).length;
    return {
      valid: (min === undefined || length >= Number(min))
        && (max === undefined || length <= Number(max)),
    };
  },
  numeric: ({ value, min, max }) => ({
    valid: Number.isFinite(Number(value))
      && (min === undefined || Number(value) >= Number(min))
      && (max === undefined || Number(value) <= Number(max)),
  }),
  email: ({ value }) => ({
    valid: /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(
      String(value),
    ),
  }),
  and: ({ values }) =>
    (values as unknown[]).every(value => coerceBoolean(value)),
  or: ({ values }) => (values as unknown[]).some(value => coerceBoolean(value)),
  not: ({ value }) => !coerceBoolean(value),
  formatString: ({ value }, context) => formatString(value as string, context),
  formatNumber: ({ value, decimals, grouping }) =>
    new Intl.NumberFormat('en-US', {
      useGrouping: grouping === undefined ? true : coerceBoolean(grouping),
      ...(decimals === undefined
        ? {}
        : {
          minimumFractionDigits: Number(decimals),
          maximumFractionDigits: Number(decimals),
        }),
    }).format(Number(value)),
  formatCurrency: ({ value, currency, decimals = 2, grouping }) => {
    const code = String(currency).toUpperCase();
    const options: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: code,
      useGrouping: grouping === undefined ? true : coerceBoolean(grouping),
      minimumFractionDigits: Number(decimals),
      maximumFractionDigits: Number(decimals),
    };
    try {
      return new Intl.NumberFormat('en-US', options).format(Number(value));
    } catch {
      return new Intl.NumberFormat('en-US', {
        ...options,
        currency: 'USD',
        currencyDisplay: 'code',
      })
        .formatToParts(Number(value)).map(part =>
          part.type === 'currency' ? code : part.value
        ).join('');
    }
  },
  formatDate: ({ value, format }) => formatDate(value, String(format)),
  pluralize: args => {
    const value = Number(args['value']);
    let exact: string | undefined;
    if (value === 0) exact = 'zero';
    else if (value === 1) exact = 'one';
    else if (value === 2) exact = 'two';
    const category = exact && args[exact] !== undefined
      ? exact
      : new Intl.PluralRules('en-US').select(value);
    return args[category] ?? args['other'];
  },
  openUrl: ({ url }) => {
    const target = new URL(String(url));
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(target.protocol)) {
      throw new Error('Unsupported URL scheme');
    }
    if (typeof window !== 'undefined') {
      window.open(target.href, '_blank', 'noopener,noreferrer');
    }
  },
};

/** Official 1.0 basic functions plus explicitly declared Lynx catalog utilities. */
export const basicFunctions: readonly CatalogFunctionEntry[] = [
  ...Object.entries(functionSchemas).map(
    ([name, schema]): CatalogFunctionEntry => {
      const definition: FunctionDefinition = {
        name,
        parameters: schema.properties.args,
        returnType: schema.returnType as FunctionDefinition['returnType'],
        allowedCallers: 'rendererOnly',
        description: schema.description,
        ...('requiresUserActivation' in schema
          ? { requiresUserActivation: schema.requiresUserActivation }
          : {}),
      };
      return {
        kind: 'function',
        name,
        definition,
        impl: (args, context) => {
          if (
            name === 'formatString' && args['value'] === undefined
          ) throw new Error('formatString requires a value argument');
          return implementations[name]!(
            validateArguments(args, definition.parameters),
            context,
          );
        },
      };
    },
  ),
  ...extraFunctions,
];

/** Register the same declared functions for consumers of the store API. */
export function registerBasicFunctions(): void {
  for (const entry of basicFunctions) {
    if (entry.impl) {
      functionRegistry.register({
        name: entry.name,
        impl: entry.impl,
        ...(entry.definition ? { definition: entry.definition } : {}),
      });
    }
  }
}
