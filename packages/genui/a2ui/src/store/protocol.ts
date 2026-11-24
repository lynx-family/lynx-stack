// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { ServerToClientMessage } from './types.js';

/** Replay inline v1.0 initialization through the existing update handlers. */
export function expandMessage(
  message: ServerToClientMessage,
): ServerToClientMessage[] {
  if (!('createSurface' in message)) {
    return [message];
  }
  const { components, dataModel, ...createSurface } = message.createSurface;
  const envelope = {
    version: message.version,
    ...(message.messageId ? { messageId: message.messageId } : {}),
  };
  return [
    { ...envelope, createSurface },
    ...(components === undefined
      ? []
      : [{
        ...envelope,
        updateComponents: { surfaceId: createSurface.surfaceId, components },
      }]),
    ...(dataModel === undefined
      ? []
      : [{
        ...envelope,
        updateDataModel: {
          surfaceId: createSurface.surfaceId,
          value: dataModel,
        },
      }]),
  ];
}

/** Split a JSON Pointer into unescaped keys. A leading slash is optional. */
function pointerSegments(path: string): string[] {
  return path === '/' || path === ''
    ? []
    : path.replace(/^\//, '').split('/').map(key =>
      key.replace(/~1/g, '/').replace(/~0/g, '~')
    );
}

/** Escape one key for use inside a JSON Pointer. */
export function escapePointerSegment(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Canonical absolute form of a data-model path: `/` for the root. */
export function normalizePointer(path: string): string {
  if (path === '' || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Read the value at a JSON Pointer, or `undefined` when any step is missing.
 * Sees exactly the entries `flattenDataModel` reports.
 */
export function readDataModel(current: unknown, path: string): unknown {
  let value = current;
  for (const key of pointerSegments(path)) {
    if (
      value === null || typeof value !== 'object'
      || !Object.prototype.propertyIsEnumerable.call(value, key)
    ) {
      return undefined;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

/** Immutable JSON Pointer replacement/deletion for v1.0 data models. */
export function replaceDataModel(
  current: unknown,
  path: string,
  value: unknown,
): unknown {
  const segments = pointerSegments(path);
  const set = (container: unknown, index: number): unknown => {
    if (index === segments.length) return value === null ? undefined : value;
    const key = segments[index]!;
    const next = Array.isArray(container)
      ? [...container as unknown[]]
      : { ...(container && typeof container === 'object' ? container : {}) };
    const record = next as Record<string, unknown>;
    const child = Object.prototype.hasOwnProperty.call(record, key)
      ? record[key]
      : undefined;
    if (index === segments.length - 1 && value === null) {
      if (Array.isArray(next) && /^(?:0|[1-9]\d*)$/.test(key)) {
        next.splice(Number(key), 1);
      } else delete record[key];
    } else {
      Object.defineProperty(next, key, {
        value: set(child, index + 1),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return next;
  };
  return set(current, 0);
}

/** Flatten typed JSON values, retaining containers for template expansion. */
export function flattenDataModel(
  value: unknown,
  path = '/',
  result = new Map<string, unknown>(),
): Map<string, unknown> {
  if (value === undefined) return result;
  result.set(path, value);
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenDataModel(
        child,
        `${path === '/' ? '' : path}/${escapePointerSegment(key)}`,
        result,
      );
    }
  }
  return result;
}
