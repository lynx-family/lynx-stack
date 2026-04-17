// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { effect } from '@preact/signals';

import { useEffect, useState } from '@lynx-js/react';

import type { Surface } from './types.js';

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

  const signalValue = signal?.value as T | undefined;

  const currentValue = path
    ? (signalValue ?? (initialValue as T | undefined))
    : (initialValue as T | undefined ?? fallbackValue);

  const setValue = (newValue: T) => {
    if (path && surface?.store) {
      surface.store.update(path, newValue);
    }
  };

  return [currentValue, setValue, path];
}

function isDataBinding(prop: unknown): boolean {
  // In 0.9, a binding is typically { path: string }
  // Exclude template configurations like { path: string, componentId: string }
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

export function useResolvedProps(
  properties: Record<string, unknown>,
  surface: Surface | undefined,
  dataContextPath?: string,
): readonly [Record<string, unknown>, (key: string, value: unknown) => void] {
  const [resolved, setResolved] = useState(() =>
    resolveProperties(properties, surface, dataContextPath)
  );

  useEffect(() => {
    if (!surface?.store) return;
    const dispose = effect(() => {
      setResolved(resolveProperties(properties, surface, dataContextPath));
    });
    return dispose;
  }, [properties, surface, dataContextPath]);

  const setValue = (key: string, value: unknown) => {
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
  };

  return [resolved, setValue] as readonly [
    Record<string, unknown>,
    (key: string, value: unknown) => void,
  ];
}
