// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { functionRegistry } from './FunctionRegistry.js';
import type {
  FunctionCallContext,
  FunctionImpl,
  FunctionRegistry,
} from './FunctionRegistry.js';
import type { MessageProcessor } from './MessageProcessor.js';
import { resolveDynamicValue } from './resolveDynamic.js';
import { createResolvedSignal } from './signalResolution.js';
import { setInStore } from './SignalStore.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';

/**
 * Options controlling how function calls are resolved against a catalog.
 */
export interface ResolveFunctionOptions {
  functions?: readonly CatalogFunctionEntry[] | undefined;
  registry?: FunctionRegistry | undefined;
}

function resolveFunctionImpl(
  name: string,
  options: ResolveFunctionOptions,
): FunctionImpl | undefined {
  const scoped = options.functions?.find(entry => entry.name === name)?.impl;
  if (scoped) return scoped;
  return (options.registry ?? functionRegistry).resolve(name);
}

const warnedUnknownFunctions = new Set<string>();

function createFunctionContext(
  processor: MessageProcessor,
  surfaceId: string,
  dataContextPath: string | undefined,
  options: ResolveFunctionOptions,
): FunctionCallContext {
  return {
    processor,
    surfaceId,
    ...(dataContextPath === undefined ? {} : { dataContextPath }),
    resolveDynamicValue(value) {
      return resolveDynamicValue(
        processor,
        value,
        surfaceId,
        dataContextPath,
        {
          ...options,
          resolveFunctionCall: executeFunctionCall,
          registry: options.registry ?? functionRegistry,
        },
      );
    },
    resolveSignal(value) {
      return createResolvedSignal(
        processor,
        value,
        surfaceId,
        dataContextPath,
        {
          ...options,
          resolveFunctionCall: executeFunctionCall,
          registry: options.registry ?? functionRegistry,
        },
      );
    },
    set(path, value) {
      setInStore(processor, path, value, surfaceId, dataContextPath);
    },
  };
}

/**
 * Resolve every argument in a protocol function call before invoking the
 * registered implementation.
 */
export function resolveFunctionArguments(
  processor: MessageProcessor,
  args: Record<string, unknown> | undefined,
  surfaceId: string,
  dataContextPath?: string,
  options: ResolveFunctionOptions = {},
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  if (!args) return resolved;
  for (const [key, raw] of Object.entries(args)) {
    resolved[key] = resolveDynamicValue(
      processor,
      raw,
      surfaceId,
      dataContextPath,
      {
        ...options,
        resolveFunctionCall: executeFunctionCall,
        registry: options.registry ?? functionRegistry,
      },
    );
  }
  return resolved;
}

export type ExecuteFunctionCall = typeof executeFunctionCall;
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
  options: ResolveFunctionOptions = {},
): unknown {
  const impl = resolveFunctionImpl(fn.call, options);
  const resolvedArgs = resolveFunctionArguments(
    processor,
    fn.args,
    surfaceId,
    dataContextPath,
    options,
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
  try {
    return impl(
      resolvedArgs,
      createFunctionContext(processor, surfaceId, dataContextPath, options),
    );
  } catch (error) {
    console.warn(
      `[a2ui] Function "${fn.call}" threw while resolving. Returning undefined.`,
      error,
    );
    return undefined;
  }
}
