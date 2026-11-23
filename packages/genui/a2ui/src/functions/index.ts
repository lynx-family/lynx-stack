// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import functionSchemas from './basic-functions.json' with { type: 'json' };
import { extraFunctions } from './extraFunctions.js';
import { formatCurrency, formatNumber } from './formatNumber.js';
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
  const month = [
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
  ][date.getUTCMonth()]!;
  const weekday = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][date.getUTCDay()]!;
  const hours = date.getUTCHours();
  const tokens: Record<string, string | number> = {
    yyyy: date.getUTCFullYear(),
    yy: String(date.getUTCFullYear()).slice(-2),
    MMMM: month,
    MMM: month.slice(0, 3),
    MM: String(date.getUTCMonth() + 1).padStart(2, '0'),
    M: date.getUTCMonth() + 1,
    dd: String(date.getUTCDate()).padStart(2, '0'),
    d: date.getUTCDate(),
    EEEE: weekday,
    E: weekday.slice(0, 3),
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
    formatNumber(Number(value), decimals, grouping),
  formatCurrency: ({ value, currency, decimals = 2, grouping }) =>
    formatCurrency(Number(value), String(currency), decimals, grouping),
  formatDate: ({ value, format }) => formatDate(value, String(format)),
  pluralize: args => {
    const value = Number(args['value']);
    let exact: string | undefined;
    if (value === 0) exact = 'zero';
    else if (value === 1) exact = 'one';
    else if (value === 2) exact = 'two';
    const category = exact && args[exact] !== undefined
      ? exact
      : (formatNumber(Math.abs(value), undefined, false) === '1'
        ? 'one'
        : 'other');
    return args[category] ?? args['other'];
  },
};

/** Host capabilities used by the built-in A2UI functions. */
export interface BasicFunctionOptions {
  /**
   * Open a validated http, https, mailto, or tel URL through the native host.
   * Rejected promises are reported through the renderer's function error handling.
   * @defaultValue Browser window.open when available; otherwise an error is thrown.
   * @example
   * { openUrl: url => hostNavigation.open(url) }
   */
  openUrl?: (url: string) => void | Promise<void>;
}

function openUrl(
  url: string,
  handler: BasicFunctionOptions['openUrl'],
): void | Promise<void> {
  const target = url.trim();
  if (
    !/^(?:https?|mailto|tel):/i.test(target)
    || [...target].some(char =>
      char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127
    )
  ) {
    throw new Error('Unsupported URL scheme');
  }
  if (handler) return handler(target);
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(target, '_blank', 'noopener,noreferrer');
    return;
  }
  throw new Error(
    'openUrl requires a host handler; use createBasicFunctions({ openUrl })',
  );
}

/**
 * Create basic catalog functions with per-catalog host capabilities.
 * @param options - Native host callbacks; browser navigation is used by default.
 * @example
 * const functions = createBasicFunctions({ openUrl: url => hostNavigation.open(url) });
 * // Pass [...components, ...functions] as the A2UI catalogs prop.
 */
export function createBasicFunctions(
  options: BasicFunctionOptions = {},
): readonly CatalogFunctionEntry[] {
  return [
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
            const validated = validateArguments(args, definition.parameters);
            if (name === 'openUrl') {
              return openUrl(String(validated['url']), options.openUrl);
            }
            return implementations[name]!(validated, context);
          },
        };
      },
    ),
    ...extraFunctions,
  ];
}

/** Official 1.0 basic functions plus explicitly declared Lynx catalog utilities. */
export const basicFunctions: readonly CatalogFunctionEntry[] =
  createBasicFunctions();

/**
 * Register the declared functions and host callbacks in the shared store registry.
 * @param options - Native host callbacks; browser navigation is used by default.
 * @example
 * registerBasicFunctions({ openUrl: url => hostNavigation.open(url) });
 */
export function registerBasicFunctions(
  options: BasicFunctionOptions = {},
): void {
  for (const entry of createBasicFunctions(options)) {
    if (entry.impl) {
      functionRegistry.register({
        name: entry.name,
        impl: entry.impl,
        ...(entry.definition ? { definition: entry.definition } : {}),
      });
    }
  }
}
