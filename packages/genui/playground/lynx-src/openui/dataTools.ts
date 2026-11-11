// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { evaluate } from '@openuidev/lang-core';
import type { ParseResult } from '@openuidev/lang-core';

import {
  createQueryDataTools,
  getQueryDefaults,
} from '@lynx-js/genui/openui/data-tools';

export const OPENUI_DATA_TOOL = 'OPENUI_DATA_TOOL';
export const OPENUI_QUERY_DEFAULTS = 'OPENUI_QUERY_DEFAULTS';

export interface LocalDataRequest {
  operation: 'query' | 'mutation' | 'initialize';
  rawText: string;
  args: Record<string, unknown>;
}

/** Adapt the Playground bridge envelope to shared local Query tools. */
export function createDataTools(
  call: (request: LocalDataRequest) => Promise<unknown>,
) {
  let currentScope: string | undefined;
  const queryKeys = new Map<string, string>();
  const runtime = createQueryDataTools({
    async call({ scope, operation, args }) {
      // Persistence and initialQueryResults use statement IDs; tool keys may be aliases.
      const names = operation === 'initialize' ? [] : [...queryKeys]
        .filter(([, key]) => key === args.key)
        .map(([name]) => name);
      if (names.length > 1) {
        throw new Error(
          `OpenUI data key "${String(args.key)}" is used by multiple Queries`,
        );
      }
      const key = names[0];
      const reply = await call({
        rawText: scope,
        operation,
        args: operation !== 'initialize' && key ? { ...args, key } : args,
      });
      assertReply(reply);
      return (reply as { value?: unknown }).value;
    },
  });
  return {
    ...runtime,
    setScope(scope: string) {
      if (scope !== currentScope) queryKeys.clear();
      currentScope = scope;
      runtime.setScope(scope);
    },
    publishParseResult(scope: string, result: ParseResult, source: string) {
      if (scope !== currentScope) return;
      const defaults = getQueryDefaults(result, { source });
      const context = {
        getState: (name: string) => result.stateDeclarations[name],
        resolveRef: () => null,
      };
      for (const query of result.queryStatements) {
        if (
          !Object.prototype.hasOwnProperty.call(defaults, query.statementId)
          || !query.toolAST
          || evaluate(query.toolAST, context) !== 'openui_query'
        ) continue;
        queryKeys.delete(query.statementId);
        const args = query.argsAST ? evaluate(query.argsAST, context) : null;
        if (
          args && typeof args === 'object' && 'key' in args
          && typeof args.key === 'string'
        ) {
          queryKeys.set(query.statementId, args.key);
        }
      }
      runtime.publishDefaults(scope, defaults);
    },
    dispose() {
      currentScope = undefined;
      queryKeys.clear();
      runtime.dispose();
    },
  };
}

function assertReply(reply: unknown): void {
  if (!reply || typeof reply !== 'object' || !('ok' in reply)) {
    throw new Error('This host does not support OpenUI local storage');
  }
  if (reply.ok !== true) {
    throw new Error(
      'error' in reply ? String(reply.error) : 'Local data operation failed',
    );
  }
}
