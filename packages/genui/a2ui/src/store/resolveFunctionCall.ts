// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';
import { computed, signal } from '@preact/signals';
import type { Signal } from '@preact/signals';

import { functionRegistry } from './FunctionRegistry.js';
import type {
  FunctionCallContext,
  FunctionImpl,
  FunctionRegistry,
} from './FunctionRegistry.js';
import type { MessageProcessor } from './MessageProcessor.js';
import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';

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

function setInStore(
  processor: MessageProcessor,
  path: string,
  value: unknown,
  surfaceId: string,
  dataContextPath?: string,
): void {
  const surface = processor.getOrCreateSurface(surfaceId);
  const resolvedPath = processor.resolvePath(path, dataContextPath);
  surface.store.update(resolvedPath, value);
}

function signalFromStore(
  processor: MessageProcessor,
  path: string,
  surfaceId: string,
  dataContextPath?: string,
): Signal<unknown> {
  const surface = processor.getOrCreateSurface(surfaceId);
  const resolvedPath = processor.resolvePath(path, dataContextPath);
  return surface.store.getSignal(resolvedPath);
}

export function resolveDynamicValue(
  processor: MessageProcessor,
  value: unknown,
  surfaceId: string,
  dataContextPath?: string,
  options: ResolveFunctionOptions = {},
): unknown {
  if (
    typeof value === 'string' || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item =>
      resolveDynamicValue(processor, item, surfaceId, dataContextPath, options)
    );
  }
  if (isDataBinding(value)) {
    return resolveFromStore(processor, value.path, surfaceId, dataContextPath);
  }
  if (isFunctionCall(value)) {
    return executeFunctionCall(
      processor,
      value,
      surfaceId,
      dataContextPath,
      options,
    );
  }
  return value;
}

function resolveSignal(
  processor: MessageProcessor,
  value: unknown,
  surfaceId: string,
  dataContextPath: string | undefined,
  options: ResolveFunctionOptions,
): Signal<unknown> {
  if (isDataBinding(value)) {
    return signalFromStore(processor, value.path, surfaceId, dataContextPath);
  }
  if (isFunctionCall(value)) {
    return computed(() =>
      executeFunctionCall(processor, value, surfaceId, dataContextPath, options)
    );
  }
  if (Array.isArray(value)) {
    return computed(() =>
      value.map(item =>
        resolveDynamicValue(
          processor,
          item,
          surfaceId,
          dataContextPath,
          options,
        )
      )
    );
  }
  return signal(value);
}

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
        options,
      );
    },
    resolveSignal(value) {
      return resolveSignal(
        processor,
        value,
        surfaceId,
        dataContextPath,
        options,
      );
    },
    set(path, value) {
      setInStore(processor, path, value, surfaceId, dataContextPath);
    },
  };
}

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
    if (Array.isArray(raw) || isDataBinding(raw) || isFunctionCall(raw)) {
      resolved[key] = resolveDynamicValue(
        processor,
        raw,
        surfaceId,
        dataContextPath,
        options,
      );
    } else if (isObject(raw)) {
      resolved[key] = { ...raw };
    } else {
      resolved[key] = resolveDynamicValue(
        processor,
        raw,
        surfaceId,
        dataContextPath,
        options,
      );
    }
  }
  return resolved;
}

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
