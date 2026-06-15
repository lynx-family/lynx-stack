// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { MessageProcessor } from './MessageProcessor.js';
import type {
  ExecuteFunctionCall,
  ResolveFunctionOptions,
} from './resolveFunctionCall.js';
import { isDataBinding, isFunctionCall, isObject } from './utils.js';

/**
 * Resolve an A2UI data-binding path against an optional component data context.
 *
 * @internal
 */
export function resolveBindingPath(
  path: string,
  dataContextPath?: string,
): string {
  if (!path) return path;
  if (path.startsWith('/')) return path;
  return dataContextPath ? `${dataContextPath}/${path}` : `/${path}`;
}

/**
 * Read a nested value from an object using a resolved JSON-pointer-style path.
 *
 * @internal
 */
export function resolveDeepValue(
  value: unknown,
  previousResolved: unknown,
  resolveLeaf: (
    value: unknown,
    previousResolved: unknown,
  ) => unknown,
): unknown {
  if (
    value === null || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    const previousItems = Array.isArray(previousResolved)
      ? previousResolved
      : [];
    let changed = false;
    const next = value.map((item, index) => {
      const resolved = resolveDeepValue(
        item,
        previousItems[index],
        resolveLeaf,
      );
      if (!Object.is(resolved, previousItems[index])) changed = true;
      return resolved;
    });
    return !changed && Array.isArray(previousResolved)
      ? previousResolved
      : next;
  }

  if (isObject(value) && !isDataBinding(value) && !isFunctionCall(value)) {
    const previousObject = (
      previousResolved && typeof previousResolved === 'object'
        ? previousResolved
        : undefined
    ) as Record<string, unknown> | undefined;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (
      const [key, item] of Object.entries(value)
    ) {
      const resolved = resolveDeepValue(
        item,
        previousObject?.[key],
        resolveLeaf,
      );
      next[key] = resolved;
      if (!Object.is(resolved, previousObject?.[key])) changed = true;
    }
    return !changed && previousObject ? previousObject : next;
  }

  return resolveLeaf(value, previousResolved);
}

export type ResolveDynamicValueOptions = ResolveFunctionOptions & {
  resolveFunctionCall?: ExecuteFunctionCall;
};

/**
 * Build the default function-call resolver used while resolving dynamic values.
 *
 * @internal
 */
export function createResolveFunctionCall(
  options: ResolveDynamicValueOptions,
): ExecuteFunctionCall | undefined {
  const resolveFunctionCall = options.resolveFunctionCall;
  if (!resolveFunctionCall) return undefined;
  return (processor, fn, surfaceId, dataContextPath) =>
    resolveFunctionCall(
      processor,
      fn,
      surfaceId,
      dataContextPath,
      {
        functions: options.functions,
        registry: options.registry,
      },
    );
}

function resolveSignal(
  processor: MessageProcessor,
  path: string,
  surfaceId: string,
  dataContextPath?: string,
): unknown {
  const surface = processor.getOrCreateSurface(surfaceId);
  const store = surface.store;
  const resolvedPath = processor.resolvePath(path, dataContextPath);
  const signal = store.getSignal(resolvedPath);
  const raw = signal.value;
  if (raw === undefined || raw === null) return raw;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * Resolve literals, data bindings, and function calls into concrete runtime
 * values for component props or action payloads.
 */
export function resolveDynamicValue(
  processor: MessageProcessor,
  value: unknown,
  surfaceId: string,
  dataContextPath?: string,
  options: ResolveDynamicValueOptions = {},
): unknown {
  const resolveFunctionCall = createResolveFunctionCall(options);

  return resolveDeepValue(
    value,
    undefined,
    (leaf) => {
      if (isDataBinding(leaf)) {
        return resolveSignal(
          processor,
          leaf.path,
          surfaceId,
          dataContextPath,
        );
      }
      if (resolveFunctionCall && isFunctionCall(leaf)) {
        return resolveFunctionCall(processor, leaf, surfaceId, dataContextPath);
      }
      return leaf;
    },
  );
}
