// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as v0_9 from '@a2ui/web_core/v0_9';

import {
  memo,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { A2UIProvider } from './A2UIProvider.jsx';
import { A2UIRenderer } from './A2UIRenderer.jsx';
import type { Catalog, CatalogInput } from '../catalog/defineCatalog.js';
import { defineCatalog } from '../catalog/defineCatalog.js';
import { MessageProcessor } from '../store/MessageProcessor.js';
import type { MessageStore } from '../store/MessageStore.js';
import { createResource } from '../store/Resource.js';
import type {
  Resource,
  ResourceInfo,
  UserActionPayload,
} from '../store/types.js';

// Mark v0_9 used so the namespace import doesn't get pruned. Kept around so
// future enhancements (typed protocol message guards) don't need a fresh
// import diff.
void v0_9;

export interface A2UIProps {
  /**
   * The raw-message buffer the developer pushes protocol messages into.
   * `<A2UI>` subscribes via `useSyncExternalStore` and processes new
   * messages incrementally.
   *
   * The internal `MessageProcessor` (surfaces, signals, resources) is
   * created once per mount and is **not reset** if `messageStore` is
   * later replaced with a different instance. Pass a `key` prop derived
   * from the store's identity if you want a fresh session, e.g.
   * `<A2UI key={turnId} messageStore={turnStore} ... />`.
   */
  messageStore: MessageStore;
  /**
   * Components the renderer is allowed to instantiate. Each item is either
   * a bare component (name read from `displayName ?? name`) or a tuple
   * `[component, manifest]` where the manifest is the JSON the extractor
   * emits at `dist/catalog/<Name>/catalog.json`.
   */
  catalogs: readonly CatalogInput[];
  /**
   * Called when a user action fires inside the rendered tree (button
   * tap, etc.). Forward to your agent and push the response messages
   * back into the same `messageStore` to update the UI. Fire-and-forget;
   * the renderer never awaits this.
   */
  onAction?: (action: UserActionPayload) => void;
  /**
   * Wrap each top-level surface so consumers can apply theme/wrapper
   * className/styles. The renderer ships no className of its own.
   */
  wrapSurface?: (
    children: ReactNode,
    ctx: { surfaceId: string },
  ) => ReactNode;
  /** Render before the first `beginRendering` arrives from the buffer. */
  renderEmpty?: () => ReactNode;
  /** Render while the active resource is pending. */
  renderFallback?: () => ReactNode;
  /** Render when the active resource fails. */
  renderError?: (err: unknown) => ReactNode;
}

interface InternalSession {
  processor: MessageProcessor;
  resources: Map<string, Resource>;
  activeMessageId: string | null;
  /** How many messages from the buffer have been processed so far. */
  processedCount: number;
}

/**
 * The all-in-one A2UI component. Owns a `MessageProcessor` internally,
 * processes raw messages from the buffer on each render, and renders
 * the most recent `beginRendering` surface tree.
 *
 * @example
 * const store = createMessageStore();
 *
 * // Developer's IO module pushes raw messages into the store.
 * async function streamFromAgent(input: string) {
 *   for await (const msg of myAgent.stream(input)) store.push(msg);
 * }
 *
 * <A2UI
 *   messageStore={store}
 *   catalogs={[Text, Button, [Card, cardManifest]]}
 *   onAction={(action) => { void streamFromAgent(serializeAction(action)); }}
 *   wrapSurface={(c) => <view className='luna-light'>{c}</view>}
 * />
 */
function A2UIImpl(props: A2UIProps): import('@lynx-js/react').ReactNode {
  const {
    messageStore,
    catalogs,
    onAction,
    wrapSurface,
    renderEmpty,
    renderFallback,
    renderError,
  } = props;

  // Keep the latest onAction in a ref so the once-mounted processor.onEvent
  // listener always calls the up-to-date prop without re-binding.
  const onActionRef = useRef<typeof onAction>(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  // Per-instance session. Created once; mutated as messages arrive.
  const sessionRef = useRef<InternalSession | null>(null);
  sessionRef.current ??= {
    processor: new MessageProcessor(),
    resources: new Map(),
    activeMessageId: null,
    processedCount: 0,
  };
  const session = sessionRef.current;

  // Counter used to force a re-render whenever the processor emits an
  // update (new beginRendering, surfaceUpdate that mutated the active
  // surface, deleteSurface). The processor's per-resource `onUpdate`
  // already handles fine-grained updates inside the active surface;
  // this is just for the activeResource pointer + first paint.
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // Subscribe to the developer's raw buffer.
  const messages = useSyncExternalStore(
    messageStore.subscribe,
    messageStore.getSnapshot,
    messageStore.getSnapshot,
  );

  // One-time wiring of processor → resource bookkeeping + onAction
  // dispatch. The processor instance itself is stable across renders.

  useEffect(() => {
    const proc = session.processor;

    const offUpdate = proc.onUpdate((data) => {
      const { type, surfaceId, messageId } = data as {
        type: string;
        surfaceId: string;
        messageId: string;
        targetId?: string;
      };
      const surface = proc.getOrCreateSurface(surfaceId);

      if (type === 'beginRendering') {
        let resource = session.resources.get(messageId);
        if (!resource) {
          resource = createResource<ResourceInfo>(messageId);
          session.resources.set(messageId, resource);
        }
        resource.complete({ type: 'beginRendering', surfaceId, surface });
        session.activeMessageId = messageId;
        forceUpdate();
      } else if (type === 'surfaceUpdate') {
        const updates =
          (data as { updates?: ReadonlyArray<{ id?: string }> }).updates ?? [];
        for (const update of updates) {
          if (!update.id) continue;
          const r = surface.resources.get(update.id);
          r?.complete({
            type: 'surfaceUpdate',
            surfaceId,
            surface,
            component: update as ResourceInfo['component'] & object,
          } as ResourceInfo);
        }
      } else if (type === 'deleteSurface') {
        const targetId = (data as { targetId?: string }).targetId
          ?? surface.rootComponentId;
        if (targetId && surface.resources.has(targetId)) {
          surface.resources.get(targetId)!.complete({
            type: 'deleteSurface',
            surfaceId,
            surface,
          });
        }
        forceUpdate();
      }
    });

    const offEvent = proc.onEvent(({ message, resolve }) => {
      // Empty resolve — there is no "response" channel from the renderer
      // back into the protocol. Responses arrive via the buffer.
      resolve([]);
      if (
        typeof message === 'object' && message !== null
        && 'userAction' in message
        && (message as { userAction: unknown }).userAction
      ) {
        const action =
          (message as { userAction: UserActionPayload }).userAction;
        try {
          onActionRef.current?.(action);
        } catch (e) {
          console.error('[a2ui] onAction handler threw:', e);
        }
      }
    });

    return () => {
      offUpdate();
      offEvent();
    };
  }, [session]);

  // Process any new messages in the buffer.

  useEffect(() => {
    if (messages.length === session.processedCount) return;
    const slice = messages.slice(
      session.processedCount,
    );
    session.processedCount = messages.length;
    if (slice.length > 0) {
      session.processor.processMessages(slice);
    }
  }, [messages, session]);

  const catalog = useMemo<Catalog>(
    () => defineCatalog(catalogs),
    [catalogs],
  );

  const activeResource = session.activeMessageId
    ? (session.resources.get(session.activeMessageId) ?? null)
    : null;

  if (!activeResource) {
    return renderEmpty?.() ?? null;
  }

  const rendererProps: import('./A2UIRenderer.jsx').A2UIRendererProps = {
    resource: activeResource,
  };
  if (wrapSurface) rendererProps.wrapSurface = wrapSurface;
  if (renderFallback) rendererProps.renderFallback = renderFallback;
  if (renderError) rendererProps.renderError = renderError;

  return (
    <A2UIProvider processor={session.processor} catalog={catalog}>
      <A2UIRenderer {...rendererProps} />
    </A2UIProvider>
  );
}

export const A2UI = memo(A2UIImpl);
