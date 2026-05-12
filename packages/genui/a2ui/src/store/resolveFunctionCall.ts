// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { functionRegistry } from './FunctionRegistry.js';
import type { MessageProcessor } from './MessageProcessor.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isDataBinding(value: unknown): value is v0_9.DataBinding {
  return isObject(value) && 'path' in value;
}

export function isFunctionCall(value: unknown): value is v0_9.FunctionCall {
  return isObject(value) && 'call' in value;
}

function resolveFromStore(
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

export function resolveDynamicValue(
  processor: MessageProcessor,
  value: unknown,
  surfaceId: string,
  dataContextPath?: string,
): unknown {
  if (
    typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item =>
      resolveDynamicValue(processor, item, surfaceId, dataContextPath)
    );
  }
  if (isDataBinding(value)) {
    return resolveFromStore(processor, value.path, surfaceId, dataContextPath);
  }
  if (isFunctionCall(value)) {
    return executeFunctionCall(processor, value, surfaceId, dataContextPath);
  }
  return value;
}

export function resolveFunctionArguments(
  processor: MessageProcessor,
  args: Record<string, unknown> | undefined,
  surfaceId: string,
  dataContextPath?: string,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  if (!args) return resolved;
  for (const [key, raw] of Object.entries(args)) {
    if (isObject(raw) && !isDataBinding(raw) && !isFunctionCall(raw)) {
      resolved[key] = { ...raw };
    } else {
      resolved[key] = resolveDynamicValue(
        processor,
        raw,
        surfaceId,
        dataContextPath,
      );
    }
  }
  return resolved;
}

const warnedUnknownFunctions = new Set<string>();

/**
 * Resolve arguments, look the function up in the registry, and invoke it.
 * When no impl is registered, log once and return `undefined` so callers
 * (checks, dynamic-property bindings) can degrade gracefully.
 */
export function executeFunctionCall(
  processor: MessageProcessor,
  fn: v0_9.FunctionCall,
  surfaceId: string,
  dataContextPath?: string,
): unknown {
  const impl = functionRegistry.resolve(fn.call);
  const resolvedArgs = resolveFunctionArguments(
    processor,
    fn.args,
    surfaceId,
    dataContextPath,
  );
  if (!impl) {
    if (!warnedUnknownFunctions.has(fn.call)) {
      warnedUnknownFunctions.add(fn.call);
      console.warn(
        `[a2ui] No client implementation registered for function `
          + `"${fn.call}". Returning undefined.`,
      );
    }
    return undefined;
  }
  return impl(resolvedArgs);
}
