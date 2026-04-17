// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type * as v0_9 from '@a2ui/web_core/v0_9';

import { processor } from './processor.js';
import type { UserActionPayload } from './types.js';

export interface ActionProps {
  id: string;
  surfaceId: string;
  dataContext?: string | undefined;
}

function isDataBinding(value: unknown): value is v0_9.DataBinding {
  return !!value && typeof value === 'object'
    && 'path' in (value as Record<string, unknown>);
}

function isFunctionCall(value: unknown): value is v0_9.FunctionCall {
  return !!value && typeof value === 'object'
    && 'call' in (value as Record<string, unknown>);
}

function resolveFromStore(
  path: string,
  surfaceId: string,
  dataContextPath?: string,
): unknown {
  const surface = processor.getOrCreateSurface(surfaceId);
  const store = surface.store;
  const resolvedPath = processor.resolvePath(path, dataContextPath);
  const signal = store.getSignal(resolvedPath);
  const raw = signal.value;
  if (!raw) return raw;
  try {
    return JSON.parse(raw as string);
  } catch {
    return raw;
  }
}

function resolveDynamicValue(
  value: v0_9.DynamicValue,
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
    return value.map((v: unknown) => v);
  }

  if (isDataBinding(value)) {
    return resolveFromStore(value.path, surfaceId, dataContextPath);
  }

  if (isFunctionCall(value)) {
    return resolveFunctionCall(value, surfaceId, dataContextPath);
  }

  return value;
}

function resolveFunctionArguments(
  args: Record<string, unknown> | undefined,
  surfaceId: string,
  dataContextPath?: string,
): Record<string, unknown> | undefined {
  if (!args) return undefined;
  const resolved: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(args)) {
    if (isObject(val) && !isDataBinding(val) && !isFunctionCall(val)) {
      // Literal object configuration; do a shallow copy.
      resolved[key] = { ...val };
    } else {
      resolved[key] = resolveDynamicValue(
        val as v0_9.DynamicValue,
        surfaceId,
        dataContextPath,
      );
    }
  }
  return resolved;
}

function resolveFunctionCall(
  fn: v0_9.FunctionCall,
  surfaceId: string,
  dataContextPath?: string,
): Record<string, unknown> {
  return {
    call: fn.call,
    args: resolveFunctionArguments(fn.args, surfaceId, dataContextPath),
    returnType: fn.returnType,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function useAction(
  props: ActionProps,
): { sendAction: (action: v0_9.Action) => Promise<unknown> } {
  const { id, surfaceId, dataContext } = props;

  const sendAction = (action: v0_9.Action) => {
    let name = 'unknownAction';
    let context: Record<string, unknown> = {};

    if ('event' in action && action.event) {
      name = action.event.name;
      const ctx = action.event.context as Record<string, unknown> | undefined;
      if (ctx) {
        const resolvedContext: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(ctx)) {
          resolvedContext[key] = resolveDynamicValue(
            value as v0_9.DynamicValue,
            surfaceId,
            dataContext,
          );
        }
        context = resolvedContext;
      }
    } else if ('functionCall' in action && action.functionCall) {
      const fn = action.functionCall;
      name = fn.call;
      context = {
        functionCall: resolveFunctionCall(fn, surfaceId, dataContext),
      };
    }

    const userAction: UserActionPayload = {
      name,
      surfaceId,
      sourceComponentId: id,
      timestamp: new Date().toISOString(),
      context,
    };

    return processor.dispatch({ userAction });
  };

  return {
    sendAction,
  };
}
