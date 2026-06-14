// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { effect } from '@preact/signals';
import type { Signal } from '@preact/signals';

import {
  useCallback,
  useMemo,
  useRef,
  useSyncExternalStore,
} from '@lynx-js/react';

import type { CatalogFunctionEntry } from '../catalog/defineCatalog.js';
import type { MessageProcessor } from '../store/MessageProcessor.js';
import {
  resolveBindingPath,
  resolveDeepValue,
  resolveDynamicValue,
} from '../store/resolveDynamic.js';
import { executeFunctionCall } from '../store/resolveFunctionCall.js';
import type { Surface } from '../store/types.js';
import {
  isCallExpression,
  isFunctionCall,
  isPlainDataBinding,
} from '../store/utils.js';

const noop = () => {
  /* no-op subscribe disposer */
};
const noopSubscribe = (): () => void => noop;
const UNSUPPORTED_PROP = Symbol('a2ui.unsupported');

function subscribeToSignal<T>(
  signal: Signal<T> | undefined,
): (cb: () => void) => () => void {
  if (!signal) return noopSubscribe;
  return (cb: () => void) =>
    effect(() => {
      void signal.value;
      cb();
    });
}

/**
 * Subscribe to a data-model binding and return the current value at that path.
 */
export function useDataBinding<T = unknown>(
  dynamicValue: unknown,
  surface: Surface | undefined,
  dataContextPath?: string,
  fallbackValue?: T,
): [T | undefined, (newValue: T) => void, string | undefined] {
  let path: string | undefined;
  let initialValue: T | undefined;

  if (
    typeof dynamicValue === 'string'
    || typeof dynamicValue === 'number'
    || typeof dynamicValue === 'boolean'
  ) {
    // Preserve primitive type. A static `false` must stay falsy and
    // numeric props must stay numeric — stringifying breaks consumers that
    // expect `boolean | number` (e.g., `if (props.disabled)`).
    initialValue = dynamicValue as T;
  } else if (
    dynamicValue
    && typeof dynamicValue === 'object'
    && 'path' in dynamicValue
  ) {
    path = (dynamicValue as Record<string, unknown>)['path'] as
      | string
      | undefined;
  }

  if (path && !path.startsWith('/')) {
    if (dataContextPath) {
      path = `${dataContextPath}/${path}`;
    } else {
      path = `/${path}`;
    }
  }

  const signal = surface?.store && path
    ? surface.store.getSignal(
      path,
      typeof initialValue === 'string' ? initialValue : undefined,
    )
    : undefined;

  const subscribe = useMemo(() => subscribeToSignal(signal), [signal]);
  const getSnapshot = useCallback(
    () => signal?.value as T | undefined,
    [signal],
  );

  const signalValue = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );

  const currentValue = path
    ? (signalValue ?? initialValue ?? fallbackValue)
    : (initialValue ?? fallbackValue);

  const setValue = useCallback(
    (newValue: T) => {
      if (path && surface?.store) {
        surface.store.update(path, newValue);
      }
    },
    [path, surface],
  );

  return [currentValue, setValue, path];
}

/**
 * Split component props into values the renderer can resolve and values that
 * still contain unsupported dynamic syntax.
 *
 * @internal
 */
export function splitUnsupportedProps(
  properties: Record<string, unknown> | undefined,
): {
  unsupportedFields: string[];
  displayProps: Record<string, unknown> | undefined;
} {
  const unsupportedFields: string[] = [];
  if (!properties) {
    return { unsupportedFields, displayProps: properties };
  }

  const nextProps: Record<string, unknown> = {};
  let changed = false;
  for (const [key, value] of Object.entries(properties)) {
    if (value === UNSUPPORTED_PROP) {
      unsupportedFields.push(key);
      changed = true;
      continue;
    }
    nextProps[key] = value;
  }

  return {
    unsupportedFields,
    displayProps: changed ? nextProps : properties,
  };
}

/**
 * Resolve data bindings and function calls inside a component prop object.
 *
 * @internal
 */
export function resolveProperties(
  properties: Record<string, unknown>,
  surface: Surface | undefined,
  dataContextPath?: string,
  processor?: MessageProcessor,
  functions?: readonly CatalogFunctionEntry[],
  previousResolved?: Record<string, unknown>,
) {
  if (!properties) return properties;
  return resolveDeepValue(
    properties,
    previousResolved,
    (leaf) => {
      if (isFunctionCall(leaf) && surface && processor) {
        return resolveDynamicValue(
          processor,
          leaf,
          surface.surfaceId,
          dataContextPath,
          {
            functions,
            resolveFunctionCall: executeFunctionCall,
          },
        );
      }

      if (isPlainDataBinding(leaf)) {
        const rawPath = (leaf as Record<string, unknown>)['path'] as
          | string
          | undefined;
        const path = resolveBindingPath(rawPath ?? '', dataContextPath);
        if (path && surface?.store) {
          const signal = surface.store.getSignal(path);
          return signal.value;
        }
        return undefined;
      }

      if (isCallExpression(leaf)) {
        return UNSUPPORTED_PROP;
      }

      return leaf;
    },
  ) as Record<string, unknown>;
}

function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/**
 * Resolve a component's dynamic props and keep the result in sync with
 * signal-backed data model changes.
 */
export function useResolvedProps(
  properties: Record<string, unknown>,
  surface: Surface | undefined,
  dataContextPath?: string,
  processor?: MessageProcessor,
  functions?: readonly CatalogFunctionEntry[],
): readonly [Record<string, unknown>, (key: string, value: unknown) => void] {
  const cacheRef = useRef<Record<string, unknown> | null>(null);

  const computeSnapshot = useCallback(() => {
    const next = resolveProperties(
      properties,
      surface,
      dataContextPath,
      processor,
      functions,
      cacheRef.current ?? undefined,
    );
    if (cacheRef.current && shallowEqual(cacheRef.current, next)) {
      return cacheRef.current;
    }
    cacheRef.current = next;
    return next;
  }, [properties, surface, dataContextPath, processor, functions]);

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!surface?.store) return noop;
      return effect(() => {
        resolveProperties(
          properties,
          surface,
          dataContextPath,
          processor,
          functions,
          cacheRef.current ?? undefined,
        );
        cb();
      });
    },
    [properties, surface, dataContextPath, processor, functions],
  );

  const resolved = useSyncExternalStore(
    subscribe,
    computeSnapshot,
    computeSnapshot,
  );

  const setValue = useCallback(
    (key: string, value: unknown) => {
      const prop = properties?.[key];
      if (isPlainDataBinding(prop)) {
        const rawPath = (prop as Record<string, unknown>)['path'] as
          | string
          | undefined;
        const path = resolveBindingPath(rawPath ?? '', dataContextPath);
        if (path && surface?.store) {
          surface.store.update(path, value);
        }
      }
    },
    [properties, surface, dataContextPath],
  );

  return [resolved, setValue] as readonly [
    Record<string, unknown>,
    (key: string, value: unknown) => void,
  ];
}
