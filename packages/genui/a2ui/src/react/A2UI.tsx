// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { memo, useEffect, useMemo, useReducer, useRef } from '@lynx-js/react';
import type { MemoExoticComponent, ReactNode } from '@lynx-js/react';

import { A2UIProvider } from './A2UIProvider.jsx';
import { A2UIRenderer } from './A2UIRenderer.jsx';
import type { UnsupportedInfo } from './A2UIRenderer.jsx';
import {
  applyProcessorUpdate,
  attachMessageStore,
  createA2UISessionState,
  drainMessages,
} from './A2UISession.js';
import type { A2UISessionState } from './A2UISession.js';
import type { Catalog, CatalogInput } from '../catalog/defineCatalog.js';
import { defineCatalog } from '../catalog/defineCatalog.js';
import type { MessageStore } from '../store/MessageStore.js';
import type {
  RendererToAgentMessage,
  UserActionPayload,
} from '../store/types.js';

/**
 * Props for the all-in-one A2UI ReactLynx renderer.
 */
export interface A2UIProps {
  /**
   * The raw-message buffer the developer pushes protocol messages into.
   * `<A2UI>` subscribes to it and applies every `push`, `replace` and
   * `clear` in the order it was made.
   *
   * Pass `null` to render nothing and end the current rendering session,
   * without calling `renderEmpty`. Passing a store afterward starts a new
   * session and processes all messages already in that store.
   *
   * The internal `MessageProcessor` (surfaces, signals, resources) is
   * retained while `messageStore` stays non-null. Replacing the store
   * directly with a different instance reconciles the rendered state to the
   * new store's contents, as `replace` does: unchanged components stay
   * mounted and RPC messages already in that store are not replayed. Pass a
   * `key` prop derived from the store's identity if you want a fresh
   * session instead, e.g.
   * `<A2UI key={turnId} messageStore={turnStore} ... />`.
   *
   * @example
   * <A2UI messageStore={store ?? null} catalogs={catalogs} />
   */
  messageStore: MessageStore | null;
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
  /** Exact protocol catalog id; defaults to the built-in Lynx catalog id. */
  catalogId?: string;
  /** Forward v1.0 wire events and metadata; push responses into messageStore. */
  onMessage?: (
    message: RendererToAgentMessage,
    metadata: Record<string, unknown>,
  ) => void | Promise<void>;
  /**
   * Optional class name applied to the top-level `surface-${surfaceId}`
   * view for the active surface. Use this when theme switching is
   * expressed as surface-level classes.
   */
  className?: string;
  /**
   * Wrap each top-level surface so consumers can apply an outer theme
   * shell, wrapper className, or additional styles.
   */
  wrapSurface?: (
    children: ReactNode,
    ctx: { surfaceId: string },
  ) => ReactNode;
  /** Render when a non-null messageStore has no surface ready yet. */
  renderEmpty?: () => ReactNode;
  /** Render while the active resource is pending. */
  renderFallback?: () => ReactNode;
  /** Render when the active resource fails. */
  renderError?: (err: unknown) => ReactNode;
  /** Render when unsupported data syntax or an unsupported component is encountered. */
  renderUnsupported?: (info: UnsupportedInfo) => ReactNode;
}

/**
 * The all-in-one A2UI component. Owns a `MessageProcessor` internally,
 * applies raw messages from the buffer as they arrive, and renders
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
  if (props.messageStore === null) {
    return null;
  }
  return <A2UISession {...props} messageStore={props.messageStore} />;
}

function A2UISession(
  props: A2UIProps & { messageStore: MessageStore },
): ReactNode {
  const {
    messageStore,
    catalogs,
    onAction,
    onMessage,
    catalogId = 'https://unpkg.com/@lynx-js/genui/a2ui/dist/catalog.json',
    wrapSurface,
    renderEmpty,
    renderFallback,
    renderError,
    renderUnsupported,
    className,
  } = props;

  // Keep the latest onAction in a ref so the once-mounted processor.onEvent
  // listener always calls the up-to-date prop without re-binding.
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onActionRef = useRef<typeof onAction>(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  // Per-instance session. Created once; mutated as messages arrive.
  const sessionRef = useRef<A2UISessionState | null>(null);
  sessionRef.current ??= createA2UISessionState();
  const session = sessionRef.current;
  const catalog = useMemo<Catalog>(() => defineCatalog(catalogs), [catalogs]);
  // Also the catalog for surfaces that name none, which the schema allows.
  session.processor.registerCatalog(catalogId, catalog, { default: true });

  // Counter used to force a re-render whenever the processor emits an
  // update (new beginRendering, surfaceUpdate that mutated the active
  // surface, deleteSurface). The processor's per-resource `onUpdate`
  // already handles fine-grained updates inside the active surface;
  // this is just for the activeResource pointer + first paint.
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);

  // One-time wiring of processor → resource bookkeeping + onAction
  // dispatch. The processor instance itself is stable across renders.

  useEffect(() => {
    const proc = session.processor;

    const offUpdate = proc.onUpdate((data) => {
      if (applyProcessorUpdate(session, data)) {
        forceUpdate();
      }
    });

    const offEvent = proc.onEvent(({ message, resolve, reject }) => {
      // Acknowledge transport completion; protocol responses arrive via the buffer.
      try {
        const pending = onMessageRef.current?.(
          message as RendererToAgentMessage,
          proc.getDataModelMetadata(),
        );
        void Promise.resolve(pending).then(() => resolve([]), error => {
          console.error('[a2ui] onMessage handler rejected:', error);
          reject(error);
        });
      } catch (e) {
        console.error('[a2ui] onMessage handler threw:', e);
        reject(e);
      }
      if ('action' in message) {
        try {
          onActionRef.current?.(message['action'] as UserActionPayload);
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

  // Follow the developer's buffer. Messages are applied as soon as the store
  // reports them, without re-rendering this shell for every push; the shell
  // re-renders only when the active surface changes.
  useEffect(() => {
    attachMessageStore(session, messageStore);
    const drain = () => {
      if (drainMessages(session)) forceUpdate();
    };
    const unsubscribe = messageStore.subscribe(drain);
    drain();
    return unsubscribe;
  }, [messageStore, session]);

  const activeResource = session.activeMessageId
    ? (session.resources.get(session.activeMessageId) ?? null)
    : null;

  if (!activeResource) {
    return renderEmpty?.() ?? null;
  }

  const rendererProps: import('./A2UIRenderer.js').A2UIRendererProps = {
    resource: activeResource,
  };
  if (className !== undefined) rendererProps.className = className;
  if (wrapSurface) rendererProps.wrapSurface = wrapSurface;
  if (renderFallback) rendererProps.renderFallback = renderFallback;
  if (renderError) rendererProps.renderError = renderError;
  if (renderUnsupported) rendererProps.renderUnsupported = renderUnsupported;

  return (
    <A2UIProvider processor={session.processor} catalog={catalog}>
      <A2UIRenderer key={session.replacementRevision} {...rendererProps} />
    </A2UIProvider>
  );
}

/** Render A2UI protocol messages using the supplied catalogs. */
export const A2UI: MemoExoticComponent<(props: A2UIProps) => ReactNode> = memo(
  A2UIImpl,
);
