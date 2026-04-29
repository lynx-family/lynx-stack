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

import type { Surface } from '../store/types.js';

const noop = () => {
  /* no-op subscribe disposer */
};
const noopSubscribe = (): () => void => noop;

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

export function useDataBinding<T = unknown>(
  dynamicValue: unknown,
  surface: Surface | undefined,
  dataContextPath?: string,
  fallbackValue?: T,
): [T | undefined, (newValue: T) => void, string | undefined] {
  let path: string | undefined;
  let initialValue: string | undefined;

  if (typeof dynamicValue === 'string') {
    initialValue = dynamicValue;
  } else if (
    dynamicValue
    && typeof dynamicValue === 'object'
    && 'path' in dynamicValue
  ) {
    path = (dynamicValue as Record<string, unknown>)['path'] as
      | string
      | undefined;
  } else if (
    typeof dynamicValue === 'number' || typeof dynamicValue === 'boolean'
  ) {
    initialValue = String(dynamicValue);
  }

  if (path && !path.startsWith('/')) {
    if (dataContextPath) {
      path = `${dataContextPath}/${path}`;
    } else {
      path = `/${path}`;
    }
  }

  const signal = surface?.store && path
    ? surface.store.getSignal(path, initialValue)
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
    ? (signalValue ?? (initialValue as T | undefined))
    : (initialValue as T | undefined ?? fallbackValue);

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

function isDataBinding(prop: unknown): boolean {
  return Boolean(
    prop
      && typeof prop === 'object'
      && 'path' in prop
      && !('componentId' in prop),
  );
}

function resolveProperties(
  properties: Record<string, unknown>,
  surface: Surface | undefined,
  dataContextPath?: string,
) {
  if (!properties) return properties;
  const result: Record<string, unknown> = {};
  for (const key in properties) {
    const prop = properties[key];
    if (isDataBinding(prop)) {
      let path = (prop as Record<string, unknown>)['path'] as
        | string
        | undefined;
      if (path && typeof path === 'string' && !path.startsWith('/')) {
        path = dataContextPath ? `${dataContextPath}/${path}` : `/${path}`;
      }

      if (path && surface?.store) {
        const signal = surface.store.getSignal(path);
        result[key] = signal.value;
      } else {
        result[key] = undefined;
      }
    } else if (
      typeof prop === 'string'
      || typeof prop === 'number'
      || typeof prop === 'boolean'
    ) {
      result[key] = prop;
    } else {
      result[key] = prop;
    }
  }
  return result;
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

export function useResolvedProps(
  properties: Record<string, unknown>,
  surface: Surface | undefined,
  dataContextPath?: string,
): readonly [Record<string, unknown>, (key: string, value: unknown) => void] {
  const cacheRef = useRef<Record<string, unknown> | null>(null);

  const computeSnapshot = useCallback(() => {
    const next = resolveProperties(properties, surface, dataContextPath);
    if (cacheRef.current && shallowEqual(cacheRef.current, next)) {
      return cacheRef.current;
    }
    cacheRef.current = next;
    return next;
  }, [properties, surface, dataContextPath]);

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!surface?.store) return noop;
      return effect(() => {
        resolveProperties(properties, surface, dataContextPath);
        cb();
      });
    },
    [properties, surface, dataContextPath],
  );

  const resolved = useSyncExternalStore(
    subscribe,
    computeSnapshot,
    computeSnapshot,
  );

  const setValue = useCallback(
    (key: string, value: unknown) => {
      const prop = properties?.[key];
      if (isDataBinding(prop)) {
        let path = (prop as Record<string, unknown>)['path'] as
          | string
          | undefined;
        if (path && surface?.store) {
          if (!path.startsWith('/')) {
            path = dataContextPath ? `${dataContextPath}/${path}` : `/${path}`;
          }
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
