// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const UNSAFE_OBJECT_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeJsonValue(item));
  if (!isRecord(value)) return value;

  const sanitized: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) continue;
    sanitized[key] = sanitizeJsonValue(child);
  }
  return sanitized;
}

function cloneDataValue(value: unknown): unknown {
  try {
    return sanitizeJsonValue(JSON.parse(JSON.stringify(value)) as unknown);
  } catch {
    return undefined;
  }
}

export function cloneDataModel(
  value: Record<string, unknown>,
): Record<string, unknown> {
  const cloned = cloneDataValue(value);
  return isRecord(cloned) ? cloned : {};
}

export function applyDataModel(
  model: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path || path === '/') {
    for (const key of Object.keys(model)) delete model[key];
    const cloned = cloneDataValue(value);
    if (!isRecord(cloned)) return;
    for (const [key, child] of Object.entries(cloned)) {
      model[key] = child;
    }
    return;
  }

  const parts = path.replace(/^\//u, '').split('/').filter(Boolean);
  if (parts.some((part) => UNSAFE_OBJECT_KEYS.has(part))) return;

  let cursor = model;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!key) continue;
    const child = Object.prototype.hasOwnProperty.call(cursor, key)
      ? cursor[key]
      : undefined;
    if (!isRecord(child)) cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  }

  const last = parts[parts.length - 1];
  if (!last) return;
  if (value === undefined) {
    delete cursor[last];
  } else {
    cursor[last] = cloneDataValue(value);
  }
}
