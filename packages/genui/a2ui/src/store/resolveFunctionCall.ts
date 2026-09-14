// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

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
import type { ProtocolFunctionCall } from './types.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';

/**
 * Options controlling how function calls are resolved against a catalog.
 */
export interface ResolveFunctionOptions {
  /** Await a fresh RPC for explicit actions; dynamic bindings reuse a reactive result. */
  awaitResult?: boolean;
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
  fn: ProtocolFunctionCall,
  surfaceId: string,
  dataContextPath?: string,
  options: ResolveFunctionOptions = {},
): unknown {
  const surface = processor.getOrCreateSurface(surfaceId);
  if (surface.version === 'v1.0' && fn.call === '@index') {
    if (!dataContextPath) return undefined;
    const parentPath =
      dataContextPath.slice(0, dataContextPath.lastIndexOf('/')) || '/';
    const key = dataContextPath.slice(dataContextPath.lastIndexOf('/') + 1);
    const collection = surface.store.getSignal(parentPath).value;
    const index = collection && typeof collection === 'object'
      ? Object.keys(collection).indexOf(key)
      : -1;
    return index < 0 ? undefined : index + Number(fn.args?.['offset'] ?? 0);
  }
  if (surface.version === 'v1.0') {
    const catalogId = fn.catalogId ?? surface.catalogId;
    const catalog = processor.getCatalog(catalogId);
    if (!catalog) return undefined;
    options = { ...options, functions: catalog.functions };
    const entry = catalog.functions.find(entry => entry.name === fn.call);
    if (entry?.definition?.allowedCallers === 'agentOnly') return undefined;
    if (!entry) {
      const request = {
        ...fn,
        ...(catalogId ? { catalogId } : {}),
        args: resolveFunctionArguments(
          processor,
          fn.args,
          surfaceId,
          dataContextPath,
          options,
        ),
      };
      return options.awaitResult
        ? processor.callAgentFunction(surfaceId, request)
        : processor.resolveAgentFunction(surfaceId, request);
    }
  }
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
