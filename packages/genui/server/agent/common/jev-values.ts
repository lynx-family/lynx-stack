// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { isRecord } from './jev-tree.js';

export interface JevValueChoice {
  value: unknown;
  description: string;
  /** A synthetic empty value, not an explicit input or a Schema constant. */
  placeholder?: boolean;
}

export interface JevRankedValueChoice extends JevValueChoice {
  rank: number;
  explicit: boolean;
}

export interface JevValueBinding {
  value: unknown;
  /** Only used locally for validation; never included in the candidate description. */
  resolved: unknown;
  name: string;
  description: string;
}

export interface JevValueProperty {
  name: string;
  schema: JsonSchema;
  required?: boolean;
}

/** Shared finite-value policy; protocols supply binding encodings and resource checks. */
export function createJevValueSource(requests: string[]) {
  const supplied = suppliedValues(requests);
  return (
    prop: JevValueProperty,
    options: {
      bindings?: readonly JevValueBinding[];
      allowPlaceholder?: boolean;
      accept?: (value: unknown, resolved: unknown) => boolean;
    } = {},
  ): JevRankedValueChoice[] => {
    const choices: JevRankedValueChoice[] = [];
    const add = (choice: JevRankedValueChoice, resolved = choice.value) => {
      if (options.accept && !options.accept(choice.value, resolved)) return;
      if (choice.placeholder && !(options.allowPlaceholder ?? !prop.required)) {
        return;
      }
      choices.push(choice);
    };
    const fieldRank = (name?: string) =>
      name?.toLowerCase() === prop.name.toLowerCase();
    for (const binding of options.bindings ?? []) {
      if (!matches(binding.resolved, prop.schema)) continue;
      add({
        value: binding.value,
        description: binding.description,
        rank: fieldRank(binding.name) ? -1 : 50,
        explicit: true,
      }, binding.resolved);
    }
    for (const { value, property, rank, explicit } of supplied) {
      if (!matches(value, prop.schema)) continue;
      const exact = isConstrainedValue(value, prop.schema);
      add({
        value,
        description: JSON.stringify(value),
        rank: rank - (!explicit && exact ? 100 : 0)
          - (fieldRank(property) ? 0.5 : 0),
        explicit: explicit || exact,
      });
    }
    for (const value of literals(prop.schema)) {
      if (!matches(value, prop.schema)) continue;
      const placeholder = !isConstrainedValue(value, prop.schema)
        && (value === '' || Array.isArray(value) && value.length === 0
          || isRecord(value) && Object.keys(value).length === 0);
      add({
        value,
        description: `Catalog/default value: ${JSON.stringify(value)}`,
        rank: 200,
        explicit: !placeholder,
        ...(placeholder ? { placeholder } : {}),
      });
    }
    const seen = new Set<string>();
    const ranked = choices.sort((a, b) => a.rank - b.rank).filter(choice => {
      const key = JSON.stringify(choice.value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const explicit = ranked.filter(item => item.explicit);
    const derived = ranked.filter(item => !item.explicit && !item.placeholder);
    const limit = Math.min(96, Math.max(32, explicit.length + 8));
    const compact = explicit.slice(0, limit - Math.min(8, derived.length));
    compact.push(...derived.slice(0, limit - compact.length));
    compact.push(
      ...ranked.filter(item => item.placeholder).slice(
        0,
        limit - compact.length,
      ),
    );
    return compact.sort((a, b) => a.rank - b.rank);
  };
}

export interface JsonSchema {
  const?: unknown;
  type?: string;
  enum?: unknown;
  oneOf?: JsonSchema[];
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  description?: string;
  additionalProperties?: unknown;
  unevaluatedProperties?: unknown;
}

/** Match the Catalog schema without inventing values for open objects or functions. */
export function matches(value: unknown, schema: JsonSchema): boolean {
  if ('const' in schema) return value === schema.const;
  if (Array.isArray(schema.enum)) return schema.enum.includes(value);
  if (schema.oneOf) return schema.oneOf.some(branch => matches(value, branch));
  if (schema.type === 'array') {
    return Array.isArray(value)
      && value.every(item => !schema.items || matches(item, schema.items));
  }
  if (schema.type === 'object' || schema.properties) {
    return isRecord(value)
      && (schema.required ?? []).every(key => Object.hasOwn(value, key))
      && Object.entries(value).every(([key, item]) => {
        const prop = schema.properties?.[key];
        return prop
          ? matches(item, prop)
          : schema.additionalProperties !== false;
      });
  }
  return schema.type === undefined || typeof value === schema.type;
}

export function literals(schema: JsonSchema): unknown[] {
  if ('const' in schema) return [schema.const];
  if (Array.isArray(schema.enum)) return schema.enum;
  if (schema.oneOf) return schema.oneOf.flatMap(branch => literals(branch));
  if (schema.type === 'boolean') return [false, true];
  if (schema.type === 'number') return [0, 1, 16, 24, 48, 100, 200, 320];
  if (schema.type === 'string') return [''];
  if (schema.type === 'array') return [[]];
  if (schema.type === 'object' && (schema.required?.length ?? 0) === 0) {
    return [{}];
  }
  return [];
}

export function isConstrainedValue(
  value: unknown,
  schema: JsonSchema,
): boolean {
  return ('const' in schema && value === schema.const)
    || (Array.isArray(schema.enum) && schema.enum.includes(value))
    || (schema.oneOf?.some(branch => isConstrainedValue(value, branch))
      ?? false);
}

interface SuppliedValue {
  value: unknown;
  property?: string;
  rank: number;
  explicit: boolean;
}

/** Harvest complete content before bounded word fragments can consume its budget. */
export function suppliedValues(requests: string[]): SuppliedValue[] {
  const values: SuppliedValue[] = [];
  const phrases: { text: string; rank: number }[] = [];
  const add = (value: unknown, rank: number, property?: string) => {
    if (values.length < 512 && JSON.stringify(value).length <= 4000) {
      values.push({
        value,
        rank,
        explicit: true,
        ...(property ? { property } : {}),
      });
    }
  };
  const collect = (
    value: unknown,
    rank: number,
    property?: string,
    depth = 0,
  ) => {
    if (depth > 8 || values.length >= 512) return;
    add(value, rank, property);
    if (Array.isArray(value)) {
      value.forEach(item => collect(item, rank, property, depth + 1));
    } else if (isRecord(value)) {
      Object.entries(value).forEach(([key, item]) =>
        collect(item, rank, key, depth + 1)
      );
    }
  };
  for (const [index, request] of [...requests].reverse().entries()) {
    const rank = index * 4;
    for (const match of request.matchAll(/https?:\/\/[^\s<>"`]+/g)) {
      add(match[0], rank + 1);
    }
    for (const match of request.matchAll(/```(?:json)?([\s\S]*?)```/g)) {
      try {
        collect(JSON.parse(match[1]!), rank);
      } catch { /* Ordinary prose. */ }
    }
    try {
      collect(JSON.parse(request), rank);
    } catch { /* Ordinary prose. */ }
    for (const match of request.matchAll(/["“]([^"”\n]+)["”]/g)) {
      add(match[1]!, rank + 1);
    }
    for (
      const text of request.split(/[\n.!?。！？:：,，;；]/).map(text =>
        text.trim()
      )
    ) {
      if (!text || phrases.length >= 256) continue;
      phrases.push({ text, rank: rank + 2 });
    }
    for (const match of request.matchAll(/-?\d+(?:\.\d+)?/g)) {
      const value = Number(match[0]);
      if (Number.isFinite(value)) add(value, rank + 2);
    }
  }
  const complete = phrases.filter(({ text }) => text.length <= 160)
    .map(({ text, rank }) => ({ value: text, rank, explicit: true }));
  const fragments: SuppliedValue[] = [];
  const seen = new Set(
    [...values, ...complete].map(item => JSON.stringify(item.value)),
  );
  const segmented = phrases.map(({ text, rank }) => ({
    text,
    rank,
    words: [
      ...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text),
    ]
      .filter(part => part.isWordLike),
  }));
  // Give every phrase a turn before moving to longer n-grams or isolated words.
  for (const length of [2, 3, 4, 5, 6, 1]) {
    for (const { text, rank, words } of segmented) {
      for (let start = 0; start + length <= words.length; start++) {
        const first = words[start]!;
        const last = words[start + length - 1]!;
        const value = text.slice(first.index, last.index + last.segment.length);
        const key = JSON.stringify(value);
        if (seen.has(key) || fragments.length >= 256) continue;
        seen.add(key);
        fragments.push({ value, rank: 100 + rank, explicit: false });
      }
    }
  }
  return [...values, ...complete, ...fragments];
}
