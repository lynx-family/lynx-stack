// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { evaluate, split, tokenize } from '@openuidev/lang-core';
import type { EvaluationContext, ParseResult } from '@openuidev/lang-core';

import type { InitialQueryResults } from './types.js';

/** Optional source boundaries and evaluation context for extracting Query defaults. */
export interface QueryDefaultsOptions {
  /**
   * Original text corresponding to the parse result, used to exclude auto-closed trailing statements.
   * @defaultValue Omitted; incomplete parse results return an empty map.
   */
  source?: string;
  /**
   * Context used to evaluate default expressions without executing tools.
   * @defaultValue Parsed state declarations, with references resolving to null.
   */
  context?: EvaluationContext;
}

/**
 * Extract completed Query defaults from an existing parse result without creating a parser or executing tools.
 * @example
 * ```ts
 * const defaults = getQueryDefaults(parser.parse(source), { source });
 * ```
 */
export function getQueryDefaults(
  result: ParseResult,
  options: QueryDefaultsOptions = {},
): InitialQueryResults {
  if (result.meta.incomplete && options.source === undefined) return {};
  const incompleteId = result.meta.incomplete
    ? split(tokenize(options.source!)).pop()?.id
    : undefined;
  const context = options.context ?? {
    getState: (name: string) => result.stateDeclarations[name],
    resolveRef: () => null,
  };
  return Object.fromEntries(
    result.queryStatements
      .filter(query => query.complete && query.statementId !== incompleteId)
      .map(query => [
        query.statementId,
        query.defaultsAST ? evaluate(query.defaultsAST, context) : null,
      ]),
  );
}
