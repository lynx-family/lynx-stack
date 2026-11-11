// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type {
  InitialQueryResults,
  QueryDataStore,
  QueryDataStoreOptions,
} from './types.js';

const own = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

function clone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) => {
    if (
      item === undefined || typeof item === 'function'
      || typeof item === 'symbol' || typeof item === 'bigint'
      || (typeof item === 'number' && !Number.isFinite(item))
    ) {
      throw new Error('Query data requires a JSON value');
    }
    return item;
  })) as unknown;
}

/**
 * Create a platform-independent Query data store backed by synchronous host persistence.
 * @example
 * ```ts
 * const store = createQueryDataStore({
 *   scope: 'document-123',
 *   initialQueryResults: getQueryDefaults(parsed),
 *   storage: {
 *     read: scope => saved.get(scope) ?? null,
 *     write: (scope, data) => { saved.set(scope, data); },
 *   },
 * });
 * const initialQueryResults = store.getInitialQueryResults();
 * store.mutate('counter', 1);
 * const counter = store.query('counter');
 * ```
 */
export function createQueryDataStore(
  options: QueryDataStoreOptions,
): QueryDataStore {
  const { scope, storage } = options;
  const initial = clone(options.initialQueryResults) as InitialQueryResults;
  const read = (): InitialQueryResults => {
    const saved = storage.read(scope);
    if (saved !== null && (typeof saved !== 'object' || Array.isArray(saved))) {
      throw new Error('Stored Query data must be an object');
    }
    return saved ?? {};
  };
  const validateKey = (key: string) => {
    if (
      typeof key !== 'string' || key === '__proto__' || key === 'constructor'
      || key === 'prototype' || !own(initial, key)
    ) {
      throw new Error('Unknown OpenUI data resource');
    }
  };
  const getSnapshot = (): Record<string, unknown> =>
    clone({ ...initial, ...read() }) as Record<string, unknown>;
  return {
    getSnapshot,
    getInitialQueryResults(prefetched = {}) {
      const saved = read();
      return clone({
        ...prefetched,
        ...Object.fromEntries(
          Object.entries(saved)
            .filter(([key]) => own(initial, key) || own(prefetched, key)),
        ),
      }) as InitialQueryResults;
    },
    query(key) {
      validateKey(key);
      return getSnapshot()[key];
    },
    mutate(key, value) {
      validateKey(key);
      const next = clone(value);
      const data = getSnapshot();
      data[key] = next;
      storage.write(scope, data);
    },
  };
}
