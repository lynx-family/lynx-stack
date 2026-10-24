// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** Prefetched Query results keyed by Query assignment name (statement ID). */
export type InitialQueryResults = Readonly<Record<string, unknown>>;

/** Synchronous persistence supplied by the host; writes must replace a scope atomically or throw. */
export interface QueryDataStorage {
  /** Read saved Query results for a scope, or null when nothing has been saved. */
  read(scope: string): InitialQueryResults | null;
  /** Persist the complete snapshot for a scope, throwing on failure. */
  write(scope: string, data: InitialQueryResults): void;
}

/** Host dependencies and immutable defaults for a Query data store. */
export interface QueryDataStoreOptions {
  /** Host-defined data identity, such as an artifact ID or a versioned document ID. */
  scope: string;
  /** Initial JSON values keyed by Query assignment name, usually from getQueryDefaults. */
  initialQueryResults: InitialQueryResults;
  /** Host persistence adapter; the store does not access browser or native globals. */
  storage: QueryDataStorage;
}

/** Local Query and Mutation operations over host-owned persistence. */
export interface QueryDataStore {
  /** Read a detached snapshot of defaults overlaid with saved results without writing to storage. */
  getSnapshot(): InitialQueryResults;
  /**
   * Overlay saved results onto host prefetches for the renderer's initialQueryResults input.
   * Only names present in defaults or prefetches are restored; defaults themselves are not copied.
   * @param prefetched - Host prefetches; defaults to an empty object.
   */
  getInitialQueryResults(prefetched?: InitialQueryResults): InitialQueryResults;
  /** Read one declared Query result from the current persisted snapshot, preserving falsy values. */
  query(key: string): unknown;
  /** Replace one declared Query result with a detached JSON value and persist once; invalid values and storage failures throw. */
  mutate(key: string, value: unknown): void;
}
