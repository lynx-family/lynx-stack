// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { FunctionCallContext } from './FunctionRegistry.js';
import type { MessageProcessor } from './MessageProcessor.js';
import { resolveDynamicValue } from './resolveDynamic.js';
import { validateArguments } from './schema.js';
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
  userActivated?: boolean;
  /** Catalog inherited only by formatString interpolation. */
  interpolationCatalogId?: string;
  allowAgentRouting?: boolean;
  caller?: 'renderer' | 'agent';
  throwOnError?: boolean;
  functions?: readonly CatalogFunctionEntry[] | undefined;
}

export function createFunctionContext(
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
      },
    );
  }
  return resolved;
}

export type ExecuteFunctionCall = typeof executeFunctionCall;
/**
 * Resolve a catalog-qualified function, invoke it locally, or request its
 * value from the agent when no renderer implementation exists.
 */
export function executeFunctionCall(
  processor: MessageProcessor,
  fn: ProtocolFunctionCall,
  surfaceId: string,
  dataContextPath?: string,
  options: ResolveFunctionOptions = {},
): unknown {
  try {
    const result = evaluateFunctionCall(
      processor,
      fn,
      surfaceId,
      dataContextPath,
      options,
    );
    if (
      result instanceof Promise && options.awaitResult && !options.throwOnError
    ) {
      return result.catch(error => {
        processor.reportExpressionError(error, surfaceId, 'EXECUTION_ERROR');
        throw error;
      });
    }
    return result;
  } catch (error) {
    if (options.throwOnError) throw error;
    processor.reportExpressionError(
      error,
      surfaceId,
      options.awaitResult ? 'EXECUTION_ERROR' : 'EXPRESSION_ERROR',
    );
    if (options.awaitResult) {
      return Promise.reject(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    return null;
  }
}

function evaluateFunctionCall(
  processor: MessageProcessor,
  fn: ProtocolFunctionCall,
  surfaceId: string,
  dataContextPath: string | undefined,
  options: ResolveFunctionOptions,
): unknown {
  if (
    Object.keys(fn).some(key => !['@call', 'catalogId', 'args'].includes(key))
    || typeof fn['@call'] !== 'string'
    || (fn.args !== undefined
      && (!fn.args || typeof fn.args !== 'object' || Array.isArray(fn.args)))
  ) {
    throw new Error('Invalid function call shape');
  }
  const surface = processor.getOrCreateSurface(surfaceId);
  if (fn['@call'] === '@index') {
    if (!dataContextPath) throw new Error('@index requires a template context');
    const parentPath =
      dataContextPath.slice(0, dataContextPath.lastIndexOf('/')) || '/';
    const key = dataContextPath.slice(dataContextPath.lastIndexOf('/') + 1);
    const collection = surface.store.getSignal(parentPath).value;
    const index = collection && typeof collection === 'object'
      ? Object.keys(collection).indexOf(key)
      : -1;
    const offset = resolveDynamicValue(
      processor,
      fn.args?.['offset'] ?? 0,
      surfaceId,
      dataContextPath,
      { ...options, resolveFunctionCall: executeFunctionCall },
    );
    if (index < 0 || typeof offset !== 'number') {
      throw new Error('Invalid @index context or offset');
    }
    return index + offset;
  }
  if (fn['@call'].startsWith('@')) {
    throw new Error(`Unknown system function ${fn['@call']}`);
  }
  const catalogId = fn.catalogId ?? options.interpolationCatalogId
    ?? surface.catalogId;
  const catalog = processor.getCatalog(catalogId);
  if (!catalog) throw new Error('Unknown function catalog');
  options = { ...options, functions: catalog.functions };
  const entry = catalog.functions.find(entry => entry.name === fn['@call']);
  const definition = entry?.definition;
  const caller = options.caller ?? 'renderer';
  if (
    (caller === 'renderer' && definition?.allowedCallers === 'agentOnly')
    || (caller === 'agent'
      && (!entry?.impl
        || (definition?.allowedCallers ?? 'rendererOnly') === 'rendererOnly'))
    || (definition?.requiresUserActivation && !options.userActivated)
  ) {
    throw new Error(
      `Function "${fn['@call']}" is not allowed in this evaluation context`,
    );
  }
  const resolved = resolveFunctionArguments(
    processor,
    fn.args,
    surfaceId,
    dataContextPath,
    { ...options, throwOnError: true },
  );
  const invoke = (values: Record<string, unknown>) => {
    const args = definition
      ? validateArguments(values, definition.parameters)
      : values;
    if (!entry?.impl) {
      if (options.allowAgentRouting === false) {
        throw new Error(
          `Interpolation function "${
            fn['@call']
          }" has no renderer implementation`,
        );
      }
      const request = { ...fn, catalogId: catalogId!, args };
      return options.awaitResult
        ? processor.callAgentFunction(surfaceId, request)
        : processor.resolveAgentFunction(
          surfaceId,
          request,
          options.throwOnError,
        );
    }
    const cacheKey = JSON.stringify([surfaceId, fn['@call'], catalogId, args]);
    const cached = options.awaitResult
      ? undefined
      : processor.getAsyncFunctionValue(cacheKey, options.throwOnError);
    if (cached) return cached.value;
    const contextOptions = fn['@call'] === 'formatString'
      ? {
        ...options,
        interpolationCatalogId: catalogId!,
        allowAgentRouting: false,
      }
      : options;
    const result = entry.impl(
      args,
      createFunctionContext(processor, surfaceId, dataContextPath, {
        ...contextOptions,
        throwOnError: true,
      }),
    );
    if (result instanceof Promise && !options.awaitResult) {
      return processor.resolveAsyncFunction(cacheKey, surfaceId, () => result);
    }
    return result;
  };
  return options.awaitResult && hasPendingValue(resolved)
    ? awaitResolvedValues(resolved).then(invoke)
    : invoke(resolved);
}

/** Await nested expression results before imperative calls or event dispatch. */
export async function awaitResolvedValues<T>(value: T): Promise<T> {
  const settled = await value;
  if (Array.isArray(settled)) {
    return await Promise.all(
      (settled as unknown[]).map(item => awaitResolvedValues(item)),
    ) as T;
  }
  if (settled !== null && typeof settled === 'object') {
    const entries = await Promise.all(
      Object.entries(settled as Record<string, unknown>).map(async (
        [key, item],
      ) => [key, await awaitResolvedValues(item)]),
    );
    return Object.fromEntries(entries) as T;
  }
  return settled;
}

function hasPendingValue(value: unknown): boolean {
  if (value instanceof Promise) return true;
  return value !== null && typeof value === 'object'
    && Object.values(value).some(item => hasPendingValue(item));
}
