// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { memo, useEffect, useState } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { componentRegistry } from './ComponentRegistry.js';
import type { ComponentInstance, Resource, Surface } from './types.js';
import { useAction } from './useAction.js';
import { useResolvedProps } from './useDataBinding.js';

function Loading(props: { id: string }) {
  const content = `loading ${props.id}...`;
  return (
    <view
      style={{
        width: '100%',
        minHeight: '20px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <text style={{ color: '#666' }}>{content}</text>
    </view>
  );
}

function buildNodeRecursive(
  component: ComponentInstance,
  surface: Surface,
  resolvedProps?: Record<string, unknown>,
  setValue?: (key: string, value: unknown) => void,
  sendAction?: (action: Record<string, unknown>) => void,
): ReactNode {
  const tag = component.component;

  if (componentRegistry.has(tag)) {
    const Component = componentRegistry.get(tag)! as unknown as (
      props: Record<string, unknown>,
    ) => import('@lynx-js/react').ReactNode;
    return (
      <Component
        key={component.id}
        id={component.id ?? ''}
        surface={surface}
        setValue={setValue}
        sendAction={(a: Record<string, unknown>) => {
          void sendAction?.(a);
        }}
        dataContextPath={component.dataContextPath}
        {...resolvedProps}
      />
    );
  }

  console.warn(`Component ${tag} not registered in v0.9 registry.`);
  return null;
}

function A2UIRenderImpl(
  props: {
    resource: Resource;
    renderFallback?: () => import('@lynx-js/react').ReactNode;
  },
): import('@lynx-js/react').ReactNode {
  const { resource } = props;
  const [data, setData] = useState<unknown>(() => {
    if (resource.completed) {
      try {
        return resource.read();
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!resource.completed);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    if (resource.completed) {
      try {
        const res = resource.read();
        if (active) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err as Error);
          setLoading(false);
        }
      }
    } else {
      resource.promise
        .then((res) => {
          if (active) {
            setData(res);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err as Error);
            setLoading(false);
          }
        });
    }

    const unsubscribe = resource.onUpdate((newData) => {
      if (active) {
        setData(newData);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [resource]);

  if (loading) {
    return props.renderFallback?.() ?? <Loading id={resource.id} />;
  }

  if (error) {
    return <text>Error: {String(error)}</text>;
  }

  if (!data) return null;

  const dataObj = data as Record<string, unknown>;
  const type = dataObj['type'] as string;
  const surfaceId = dataObj['surfaceId'] as string;
  const surface = dataObj['surface'] as Surface;
  const component = dataObj['component'] as ComponentInstance | undefined;
  if (type === 'beginRendering') {
    const id = surface.rootComponentId!;
    const childResource = surface.resources.get(id);
    if (!childResource) return null;
    return (
      <view id={`surface-${surfaceId}`} className='luna-light'>
        <A2UIRender resource={childResource} />
      </view>
    );
  }

  if (type === 'surfaceUpdate' && component) {
    return <NodeRenderer component={component} surface={surface} />;
  }

  if (type === 'deleteSurface') {
    return null;
  }

  return null;
}

export const A2UIRender = memo(A2UIRenderImpl);

export function NodeRenderer(
  props: { component: ComponentInstance; surface: Surface },
): import('@lynx-js/react').ReactNode {
  const { component: initialComponent, surface } = props;
  const [component, setComponent] = useState(initialComponent);

  useEffect(() => {
    setComponent(initialComponent);
  }, [initialComponent]);

  useEffect(() => {
    const resource = surface.resources.get(component.id!);
    if (!resource) return;

    return resource.onUpdate((data) => {
      const dataMap = data as unknown as Readonly<Record<string, unknown>>;
      if (dataMap['type'] === 'surfaceUpdate' && dataMap['component']) {
        setComponent({ ...(dataMap['component'] as ComponentInstance) });
      }
    });
  }, [component.id, surface]);

  const [resolvedProps, setValue] = useResolvedProps(
    component,
    surface,
    component.dataContextPath,
  );

  const { sendAction } = useAction({
    id: component.id!,
    surfaceId: surface.surfaceId,
    dataContext: component.dataContextPath,
  });

  return (
    <>
      {buildNodeRecursive(
        component,
        surface,
        resolvedProps,
        setValue,
        (a: Record<string, unknown>) => {
          void sendAction(a as unknown as Parameters<typeof sendAction>[0]);
        },
      )}
    </>
  );
}
