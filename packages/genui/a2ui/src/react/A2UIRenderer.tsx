// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { memo, useEffect, useMemo, useSyncExternalStore } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { useAction } from './useAction.js';
import { useCatalog } from './useCatalog.js';
import { useResolvedProps } from './useDataBinding.js';
import type { ComponentInstance, Resource, Surface } from '../store/types.js';

const noop = () => {
  /* no-op subscribe disposer */
};
const noopSubscribe = (): () => void => noop;
const returnUndefined = () => undefined;
const warnedTags = new Set<string>();

function DefaultLoading(props: { id: string }) {
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
  catalog: ReadonlyMap<string, (props: Record<string, unknown>) => ReactNode>,
  resolvedProps?: Record<string, unknown>,
  setValue?: (key: string, value: unknown) => void,
  sendAction?: (action: Record<string, unknown>) => void,
): ReactNode {
  const tag = component.component;
  const Component = catalog.get(tag);
  if (!Component) return null;

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

export interface A2UIRendererProps {
  resource: Resource;
  renderFallback?: () => ReactNode;
  renderError?: (e: unknown) => ReactNode;
  /**
   * Wrap each top-level surface so consumers can apply theme/wrapper
   * className/styles. The default does not wrap — that is intentional, the
   * renderer is headless. Lynx-themed shells should pass
   * `wrapSurface={(c, ctx) => <view className='luna-light'>{c}</view>}`.
   */
  wrapSurface?: (
    children: ReactNode,
    ctx: { surfaceId: string },
  ) => ReactNode;
}

function A2UIRendererImpl(
  props: A2UIRendererProps,
): import('@lynx-js/react').ReactNode {
  const { resource, wrapSurface, renderFallback, renderError } = props;
  // Eagerly read context so the renderer fails clearly outside <A2UIProvider>.
  useCatalog();

  const data = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
  const status = resource.status;
  const error = resource.error;

  if (status === 'pending' && data === undefined) {
    return renderFallback?.() ?? <DefaultLoading id={resource.id} />;
  }

  if (status === 'error') {
    return renderError?.(error) ?? <text>Error: {String(error)}</text>;
  }

  if (!data) return null;

  const dataObj = data as unknown as Record<string, unknown>;
  const type = dataObj['type'] as string;
  const surfaceId = dataObj['surfaceId'] as string;
  const surface = dataObj['surface'] as Surface;
  const component = dataObj['component'] as ComponentInstance | undefined;

  if (type === 'beginRendering') {
    const id = surface.rootComponentId!;
    const childResource = surface.resources.get(id);
    if (!childResource) return null;
    const childProps: A2UIRendererProps = { resource: childResource };
    if (wrapSurface) childProps.wrapSurface = wrapSurface;
    if (renderFallback) childProps.renderFallback = renderFallback;
    if (renderError) childProps.renderError = renderError;
    const inner = (
      <view id={`surface-${surfaceId}`}>
        <A2UIRenderer {...childProps} />
      </view>
    );
    return wrapSurface ? wrapSurface(inner, { surfaceId }) : inner;
  }

  if (type === 'surfaceUpdate' && component) {
    return <NodeRenderer component={component} surface={surface} />;
  }

  if (type === 'deleteSurface') {
    return null;
  }

  return null;
}

export const A2UIRenderer = memo(A2UIRendererImpl);

function NodeRendererImpl(
  props: {
    component: ComponentInstance;
    surface: Surface;
  },
): import('@lynx-js/react').ReactNode {
  const { component: initialComponent, surface } = props;
  const catalog = useCatalog();

  const resource = surface.resources.get(initialComponent.id!);

  const latest = useSyncExternalStore(
    resource ? resource.subscribe : noopSubscribe,
    resource ? resource.getSnapshot : returnUndefined,
    resource ? resource.getSnapshot : returnUndefined,
  );

  const component =
    (latest as { component?: ComponentInstance } | undefined)?.component
      ?? initialComponent;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  useEffect(() => {
    const tag = component.component;
    if (!catalog.has(tag) && !warnedTags.has(tag)) {
      warnedTags.add(tag);
      console.warn(`[a2ui] Component "${tag}" is not in the active catalog.`);
    }
  }, [component.component, catalog]);

  const [resolvedProps, setValue] = useResolvedProps(
    component,
    surface,
    component.dataContextPath,
  );

  const actionProps = useMemo(
    () => ({
      id: component.id!,
      surfaceId: surface.surfaceId,
      dataContext: component.dataContextPath,
    }),
    [component.id, surface.surfaceId, component.dataContextPath],
  );
  const { sendAction } = useAction(actionProps);

  return (
    <>
      {buildNodeRecursive(
        component,
        surface,
        catalog as ReadonlyMap<
          string,
          (props: Record<string, unknown>) => ReactNode
        >,
        resolvedProps,
        setValue,
        (a: Record<string, unknown>) => {
          void sendAction(a as unknown as Parameters<typeof sendAction>[0]);
        },
      )}
    </>
  );
}

export const NodeRenderer = NodeRendererImpl;
