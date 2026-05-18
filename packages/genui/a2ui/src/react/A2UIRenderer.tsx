// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { memo, useEffect, useMemo, useSyncExternalStore } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { useAction } from './useAction.js';
import { useCatalog } from './useCatalog.js';
import { splitUnsupportedProps, useResolvedProps } from './useDataBinding.js';
import type { ComponentInstance, Resource, Surface } from '../store/types.js';

const noop = () => {
  /* no-op subscribe disposer */
};
const noopSubscribe = (): () => void => noop;
const emptySnapshot = {
  status: 'pending' as const,
  value: undefined,
  error: undefined,
};
const returnEmptySnapshot = () => emptySnapshot;
const warnedTags = new Set<string>();

export interface UnsupportedInfo {
  id: string;
  tag: string;
  kind: 'component' | 'syntax';
  fields?: string[];
}

function DefaultLoading(props: { id: string }) {
  const content = `loading ${props.id}...`;
  return (
    <view
      style={{
        width: '100%',
        minHeight: '20px',
        padding: '10px',
        border: '1px solid var(--a2ui-color-border)',
        borderRadius: 'var(--a2ui-border-radius)',
        backgroundColor: 'var(--a2ui-color-surface-muted)',
        color: 'var(--a2ui-color-text-muted)',
      }}
    >
      <text style={{ color: 'inherit' }}>{content}</text>
    </view>
  );
}

function DefaultUnsupportedNotice(props: UnsupportedInfo) {
  return (
    <view
      style={{
        width: '100%',
        minHeight: '20px',
        marginBottom: '8px',
        padding: '6px',
        borderRadius: '6px',
        border: '1px dashed var(--a2ui-color-border)',
        backgroundColor: 'var(--a2ui-color-surface-muted)',
        color: 'var(--a2ui-color-text-muted)',
      }}
    >
      <text style={{ color: 'inherit', fontSize: '10px', lineHeight: '12px' }}>
        Unsupported {props.kind} in {props.id}
      </text>
    </view>
  );
}

function buildNodeRecursive(
  component: ComponentInstance,
  surface: Surface,
  catalog: ReadonlyMap<string, (props: Record<string, unknown>) => ReactNode>,
  renderUnsupported:
    | ((info: UnsupportedInfo) => ReactNode)
    | undefined,
  props?: Record<string, unknown>,
  setValue?: (key: string, value: unknown) => void,
  sendAction?: (action: Record<string, unknown>) => void,
): ReactNode {
  const tag = component.component;
  const Component = catalog.get(tag);
  const renderUnsupportedNotice = (info: UnsupportedInfo) => {
    if (typeof renderUnsupported === 'function') {
      return renderUnsupported(info);
    }
    return <DefaultUnsupportedNotice {...info} />;
  };
  if (!Component) {
    return renderUnsupportedNotice({
      id: component.id ?? '',
      tag,
      kind: 'component',
    });
  }
  const { unsupportedFields, displayProps } = splitUnsupportedProps(props);
  return (
    <>
      {unsupportedFields.length > 0
        ? (
          renderUnsupportedNotice({
            id: component.id ?? '',
            tag,
            kind: 'syntax',
            fields: unsupportedFields,
          })
        )
        : null}
      <Component
        key={component.id}
        {
          // Spread first so any data-binding key that collides with internal
          // plumbing (`surface`, `setValue`, `sendAction`, `id`,
          // `dataContextPath`) is overwritten by the explicit props below
          // rather than silently shadowing them.
          ...displayProps
        }
        id={component.id ?? ''}
        surface={surface}
        setValue={setValue}
        sendAction={(a: Record<string, unknown>) => {
          void sendAction?.(a);
        }}
        dataContextPath={component.dataContextPath}
      />
    </>
  );
}

export interface A2UIRendererProps {
  resource: Resource;
  /** Optional class name applied to the top-level surface view. */
  className?: string;
  renderFallback?: () => ReactNode;
  renderError?: (e: unknown) => ReactNode;
  renderUnsupported?: (info: UnsupportedInfo) => ReactNode;
  /**
   * Wrap each top-level surface so consumers can apply an outer theme
   * shell, wrapper className, or additional styles. The default does not
   * wrap — that is intentional, the renderer is headless. Lynx-themed
   * shells can use this together with `className` on the surface root.
   */
  wrapSurface?: (
    children: ReactNode,
    ctx: { surfaceId: string },
  ) => ReactNode;
}

function A2UIRendererImpl(
  props: A2UIRendererProps,
): import('@lynx-js/react').ReactNode {
  const {
    resource,
    renderUnsupported,
    wrapSurface,
    renderFallback,
    renderError,
    className: surfaceClassName = 'surface-root',
  } = props;
  // Eagerly read context so the renderer fails clearly outside <A2UIProvider>.
  useCatalog();

  const snapshot = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  );
  const data = snapshot.value;
  const status = snapshot.status;
  const error = snapshot.error;

  if (status === 'pending' && data === undefined) {
    // Use a ternary instead of `??` so consumers can return `null` from
    // the override callback to suppress the built-in placeholder.
    return renderFallback
      ? renderFallback()
      : <DefaultLoading id={resource.id} />;
  }

  if (status === 'error') {
    return renderError
      ? renderError(error)
      : <text>Error: {String(error)}</text>;
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
    if (renderUnsupported) childProps.renderUnsupported = renderUnsupported;

    const inner = (
      <view id={`surface-${surfaceId}`} className={surfaceClassName}>
        <A2UIRenderer {...childProps} />
      </view>
    );
    return wrapSurface ? wrapSurface(inner, { surfaceId }) : inner;
  }

  if (type === 'surfaceUpdate' && component) {
    return (
      <NodeRenderer
        component={component}
        surface={surface}
        renderUnsupported={renderUnsupported}
      />
    );
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
    renderUnsupported?:
      | ((info: UnsupportedInfo) => ReactNode)
      | undefined;
  },
): import('@lynx-js/react').ReactNode {
  const {
    component: initialComponent,
    surface,
    renderUnsupported,
  } = props;
  const catalog = useCatalog();

  const resource = surface.resources.get(initialComponent.id!);

  const latest = useSyncExternalStore(
    resource ? resource.subscribe : noopSubscribe,
    resource ? resource.getSnapshot : returnEmptySnapshot,
    resource ? resource.getSnapshot : returnEmptySnapshot,
  );

  const component =
    (latest.value as { component?: ComponentInstance } | undefined)?.component
      ?? initialComponent;
  const effectiveComponent = initialComponent.dataContextPath !== undefined
      && component.dataContextPath !== initialComponent.dataContextPath
    ? { ...component, dataContextPath: initialComponent.dataContextPath }
    : component;

  useEffect(() => {
    const tag = effectiveComponent.component;
    if (!catalog.has(tag) && !warnedTags.has(tag)) {
      warnedTags.add(tag);
      console.warn(`[a2ui] Component "${tag}" is not in the active catalog.`);
    }
  }, [effectiveComponent.component, catalog]);

  const [resolvedProps, setValue] = useResolvedProps(
    effectiveComponent,
    surface,
    effectiveComponent.dataContextPath,
  );

  const actionProps = useMemo(
    () => ({
      id: effectiveComponent.id!,
      surfaceId: surface.surfaceId,
      dataContext: effectiveComponent.dataContextPath,
    }),
    [
      effectiveComponent.id,
      surface.surfaceId,
      effectiveComponent.dataContextPath,
    ],
  );
  const { sendAction } = useAction(actionProps);

  return (
    buildNodeRecursive(
      effectiveComponent,
      surface,
      catalog as ReadonlyMap<
        string,
        (props: Record<string, unknown>) => ReactNode
      >,
      renderUnsupported,
      resolvedProps,
      setValue,
      (a: Record<string, unknown>) => {
        void sendAction(a as unknown as Parameters<typeof sendAction>[0]);
      },
    )
  );
}

export const NodeRenderer = NodeRendererImpl;
