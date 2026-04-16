import { useState, useEffect } from '@lynx-js/react';
import { effect } from '@preact/signals';
import type { Surface } from "./types";

export function useDataBinding<T = unknown>(
  dynamicValue: any,
  surface: Surface | undefined,
  dataContextPath?: string,
  fallbackValue?: T
): [T | undefined, (newValue: T) => void, string | undefined] {
  let path: string | undefined;
  let initialValue: string | undefined;

  if (typeof dynamicValue === 'string') {
    initialValue = dynamicValue;
  } else if (
    dynamicValue &&
    typeof dynamicValue === 'object' &&
    'path' in dynamicValue
  ) {
    path = dynamicValue.path;
  } else if (typeof dynamicValue === 'number' || typeof dynamicValue === 'boolean') {
    initialValue = String(dynamicValue);
  }

  if (path && !path.startsWith('/')) {
    if (dataContextPath) {
      path = `${dataContextPath}/${path}`;
    } else {
      path = `/${path}`;
    }
  }

  const signal =
    surface?.store && path
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

function isDataBinding(prop: any): boolean {
  // In 0.9, a binding is typically { path: string }
  // Exclude template configurations like { path: string, componentId: string }
  return (
    prop &&
    typeof prop === 'object' &&
    'path' in prop &&
    !('componentId' in prop)
  );
}

function resolveProperties(
  properties: any,
  surface: Surface | undefined,
  dataContextPath?: string
) {
  if (!properties) return properties;
  const result: any = {};
  for (const key in properties) {
    const prop = properties[key];
    if (isDataBinding(prop)) {
      let path = prop.path;
      if (path && !path.startsWith('/')) {
        path = dataContextPath ? `${dataContextPath}/${path}` : `/${path}`;
      }
      
      if (path && surface?.store) {
        const signal = surface.store.getSignal(path);
        result[key] = signal.value;
      } else {
        result[key] = undefined;
      }
    } else if (
      typeof prop === 'string' ||
      typeof prop === 'number' ||
      typeof prop === 'boolean'
    ) {
      result[key] = prop;
    } else {
      result[key] = prop;
    }
  }
  return result;
}

export function useResolvedProps(
  properties: any,
  surface: Surface | undefined,
  dataContextPath?: string
): readonly [any, (key: string, value: any) => void] {
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

  const setValue = (key: string, value: any) => {
    const prop = properties?.[key];
    if (isDataBinding(prop)) {
      let path = prop.path;
      if (path && surface?.store) {
        if (!path.startsWith('/')) {
          path = dataContextPath ? `${dataContextPath}/${path}` : `/${path}`;
        }
        surface.store.update(path, value);
      }
    }
  };

  return [resolved, setValue] as readonly [any, (key: string, value: any) => void];
}
