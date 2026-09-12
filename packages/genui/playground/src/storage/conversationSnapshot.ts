// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

function cloneDataValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    // Snapshot values are JSON data. Never retain an external object reference.
    return null;
  }
}

function defineOwnDataProperty(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor && !descriptor.configurable) {
    // Preserve attributes such as an array's non-configurable `length`.
    Object.defineProperty(target, key, { value });
    return;
  }
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function applyDataModel(
  model: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  if (!path || path === '/' || path === '') {
    for (const key of Object.keys(model)) {
      delete model[key];
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cloned = cloneDataValue(value);
      if (cloned && typeof cloned === 'object' && !Array.isArray(cloned)) {
        for (const [key, childValue] of Object.entries(cloned)) {
          defineOwnDataProperty(model, key, childValue);
        }
      }
    }
    return;
  }

  const parts = path.replace(/^\//u, '').split('/').filter(Boolean);
  let cursor = model;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!key) continue;
    const child = Object.prototype.hasOwnProperty.call(cursor, key)
      ? cursor[key]
      : undefined;
    if (typeof child !== 'object' || child === null) {
      const next: Record<string, unknown> = {};
      defineOwnDataProperty(cursor, key, next);
      cursor = next;
    } else {
      cursor = child as Record<string, unknown>;
    }
  }

  const last = parts[parts.length - 1];
  if (!last) return;
  if (value === undefined) {
    delete cursor[last];
  } else {
    defineOwnDataProperty(cursor, last, cloneDataValue(value));
  }
}

export function applyA2UIMessagesToSnapshot(
  dataModel: Record<string, unknown>,
  surfaceIds: Set<string>,
  messages: unknown[],
): void {
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue;
    const record = message as {
      createSurface?: { surfaceId?: unknown };
      deleteSurface?: { surfaceId?: unknown };
      updateDataModel?: { path?: unknown; value?: unknown };
    };
    if (
      record.createSurface
      && typeof record.createSurface.surfaceId === 'string'
    ) {
      surfaceIds.add(record.createSurface.surfaceId);
      continue;
    }
    if (
      record.deleteSurface
      && typeof record.deleteSurface.surfaceId === 'string'
    ) {
      surfaceIds.delete(record.deleteSurface.surfaceId);
      continue;
    }
    if (record.updateDataModel) {
      applyDataModel(
        dataModel,
        typeof record.updateDataModel.path === 'string'
          ? record.updateDataModel.path
          : '/',
        record.updateDataModel.value,
      );
    }
  }
}
