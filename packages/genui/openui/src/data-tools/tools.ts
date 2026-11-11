// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { InitialQueryResults } from './types.js';

/** Local data tool names to register with the renderer and declare to the prompt library. */
export const OPENUI_DATA_TOOL_NAMES = [
  'openui_query',
  'openui_mutation',
] as const;

/** A scoped request to initialize defaults, read a Query, or apply a Mutation through the host. */
export interface QueryDataToolRequest {
  /** Local data operation; initialize registers defaults without persisting them. */
  operation: 'initialize' | 'query' | 'mutation';
  /** Host-defined identity selected with setScope. */
  scope: string;
  /** Tool arguments, or a defaults map under the defaults key for initialize. */
  args: Record<string, unknown>;
}

/** Host access and initialization timing for local Query tools. */
export interface QueryDataToolsOptions {
  /**
   * Execute a scoped request, resolving to its value or rejecting on failure.
   * Initialize resolves when the host can serve the supplied defaults; its result is ignored.
   * The host owns transport timeouts and must honor each request's scope.
   */
  call: (request: QueryDataToolRequest) => Promise<unknown>;
  /**
   * Maximum milliseconds each tool call waits for defaults and host initialization; must be finite and nonnegative.
   * @defaultValue 5000
   */
  initializationTimeoutMs?: number;
}

/** Renderer tools and lifecycle controls for host-backed local Query data. */
export interface QueryDataTools {
  /** Select a data scope, resetting defaults and rejecting pending calls when the scope changes. */
  setScope(scope: string): void;
  /** Merge completed defaults for the current scope and initialize the host; other scopes and unchanged maps are ignored. */
  publishDefaults(scope: string, defaults: InitialQueryResults): void;
  /** Reset the scope and reject pending calls; setScope can start another lifecycle. Already dispatched host work is not aborted. */
  dispose(): void;
  /** Registered local tools; spread into the renderer's toolProvider. */
  tools: Record<
    typeof OPENUI_DATA_TOOL_NAMES[number],
    (args: Record<string, unknown>) => Promise<unknown>
  >;
}

/**
 * Coordinate local Query tools with host initialization and scope changes without depending on a renderer or transport.
 * @example
 * ```ts
 * const dataTools = createQueryDataTools({ call: request => host.execute(request) });
 * dataTools.setScope('document-123');
 * dataTools.publishDefaults('document-123', getQueryDefaults(parsed, { source }));
 * const toolProvider = { ...dataTools.tools };
 * // On unmount:
 * dataTools.dispose();
 * ```
 */
export function createQueryDataTools(
  options: QueryDataToolsOptions,
): QueryDataTools {
  const { call, initializationTimeoutMs = 5000 } = options;
  if (
    !Number.isFinite(initializationTimeoutMs) || initializationTimeoutMs < 0
  ) {
    throw new Error('initializationTimeoutMs must be finite and nonnegative');
  }
  let scope: string | undefined;
  let revision = 0;
  let defaults: InitialQueryResults = {};
  let defaultsJSON = '';
  type Initialized = { ok: true } | { ok: false; error: unknown };
  let initialization: Promise<Initialized> | undefined;
  const waiting = new Set<() => void>();
  const wake = () => {
    for (const notify of waiting) notify();
  };
  const reset = (next: string | undefined) => {
    revision++;
    scope = next;
    defaults = {};
    defaultsJSON = '';
    initialization = undefined;
    wake();
  };
  async function initialize(
    request: QueryDataToolRequest,
  ): Promise<Initialized> {
    try {
      await call(request);
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }
  async function run(
    operation: 'query' | 'mutation',
    args: Record<string, unknown>,
  ) {
    const currentScope = scope;
    if (currentScope === undefined) {
      throw new Error('OpenUI data scope is not set');
    }
    const version = revision;
    const assertCurrent = () => {
      if (version !== revision) {
        throw new Error(
          'OpenUI data scope changed during local data operation',
        );
      }
    };
    let notifyReady!: () => void;
    const ready = new Promise<void>(resolve => {
      notifyReady = resolve;
    });
    let rejectCancelled!: (error: unknown) => void;
    const cancelled = new Promise<never>((_, reject) => {
      rejectCancelled = reject;
    });
    const check = () => {
      if (version !== revision) {
        rejectCancelled(
          new Error('OpenUI data scope changed during local data operation'),
        );
      } else if (initialization) {
        notifyReady();
      }
    };
    waiting.add(check);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('OpenUI Query defaults are not ready')),
        initializationTimeoutMs,
      );
    });
    try {
      check();
      await Promise.race([ready, cancelled, timedOut]);
      assertCurrent();
      // One render pass may publish defaults from several independent inline blocks.
      let pending: typeof initialization;
      do {
        pending = initialization;
        const initialized = await Promise.race([pending!, cancelled, timedOut]);
        assertCurrent();
        if (!initialized.ok) throw initialized.error;
      } while (pending !== initialization);
      clearTimeout(timer);
      const reply = await Promise.race([
        call({ operation, scope: currentScope, args }),
        cancelled,
      ]);
      assertCurrent();
      return reply;
    } finally {
      clearTimeout(timer);
      waiting.delete(check);
    }
  }
  return {
    setScope(next) {
      if (scope !== next) reset(next);
    },
    publishDefaults(target, next) {
      if (target !== scope) return;
      const merged = { ...defaults, ...next };
      const json = JSON.stringify(merged);
      if (initialization && defaultsJSON === json) return;
      defaults = merged;
      defaultsJSON = json;
      initialization = initialize({
        operation: 'initialize',
        scope: target,
        args: { defaults },
      });
      wake();
    },
    dispose() {
      reset(undefined);
    },
    tools: {
      openui_query: args => run('query', args),
      openui_mutation: args => run('mutation', args),
    },
  };
}
