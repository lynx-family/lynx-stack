// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createQueryDataStore } from '@lynx-js/genui/openui/data-tools';

// Browser host adapter; shared QueryDataStore owns query and mutation semantics.
const PREFIX = 'openui:query-data:v1:';

/** Stable across refreshes and shares of the same DSL. The source is also checked on reads. */
export function openUIStorageKey(source: string): string {
  let hash = 2166136261;
  let second = 5381;
  for (let i = 0; i < source.length; i++) {
    hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ source.charCodeAt(i);
  }
  return `${PREFIX}${(hash >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
}

interface BrowserStorage {
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
}

/** Browser storage format and source identity belong to the Playground host. */
function createHostStore(
  source: string,
  initial: Record<string, unknown>,
  storage: BrowserStorage,
) {
  return createQueryDataStore({
    scope: source,
    initialQueryResults: initial,
    storage: {
      read(scope) {
        const stored = storage.getItem(openUIStorageKey(scope));
        if (stored === null) return null;
        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Stored OpenUI data does not match this page');
        }
        const envelope = parsed as Record<string, unknown>;
        const saved = envelope.data;
        if (
          envelope.source !== scope || !saved || typeof saved !== 'object'
          || Array.isArray(saved)
        ) {
          throw new Error('Stored OpenUI data does not match this page');
        }
        return saved as Record<string, unknown>;
      },
      write(scope, data) {
        if (!storage.setItem) throw new Error('OpenUI storage is read-only');
        storage.setItem(
          openUIStorageKey(scope),
          JSON.stringify({ source: scope, data }),
        );
      },
    },
  });
}

/** Read the same effective data used by local Query tools, without writing defaults. */
export function readOpenUILocalData(
  source: string,
  initial: Record<string, unknown>,
  storage: BrowserStorage,
): Readonly<Record<string, unknown>> {
  return createHostStore(source, initial, storage).getSnapshot();
}

/** Restore persisted values before delivering source to the renderer. */
export function restoreOpenUIData<
  T extends {
    rawText?: string;
    initialQueryResults?: Record<string, unknown>;
  },
>(output: T, storage: BrowserStorage): T {
  if (!output.rawText) return output;
  const saved = readOpenUILocalData(output.rawText, {}, storage);
  const initial = {
    ...output.initialQueryResults,
    ...saved,
  };
  return {
    ...output,
    ...(Object.keys(initial).length > 0
      ? { initialQueryResults: initial }
      : {}),
  };
}

/** Translate the preview bridge request into platform-independent data operations. */
export function executeOpenUIDataTool(
  input: unknown,
  storage: BrowserStorage,
  defaults: Record<string, unknown>,
): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Unknown OpenUI data resource');
    }
    const request = input as Record<string, unknown>;
    const rawArgs = request.args;
    if (
      typeof request.rawText !== 'string' || !request.rawText
      || !rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)
    ) {
      throw new Error('Unknown OpenUI data resource');
    }
    const args = rawArgs as Record<string, unknown>;
    if (typeof args.key !== 'string') {
      throw new Error('Unknown OpenUI data resource');
    }
    const store = createHostStore(
      request.rawText,
      defaults,
      storage,
    );
    if (request.operation === 'query') {
      return { ok: true, value: store.query(args.key) };
    }
    if (
      request.operation !== 'mutation'
      || !Object.prototype.hasOwnProperty.call(args, 'value')
    ) {
      throw new Error(
        'Mutation requires a value',
      );
    }
    store.mutate(args.key, args.value);
    return { ok: true, value: { ok: true } };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
