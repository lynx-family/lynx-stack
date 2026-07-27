// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background-thread bootstrap: installs the event bridge on
 * `lynxCoreInject.tt` and exposes the root container for preact.
 */

import { render } from 'preact';
import type { ComponentChild } from 'preact';

import {
  RemoteDocument,
  RemoteElement,
  createPageContainer,
  nodesById,
} from './document.js';

declare const lynxCoreInject: {
  tt: Record<string, unknown>;
};

let container: RemoteElement | undefined;

function dispatchEvent(handlerName: string, data: unknown): void {
  // handlerName format: `${id}:${eventType}:${eventName}`
  const first = handlerName.indexOf(':');
  const id = Number(handlerName.slice(0, first));
  const key = handlerName.slice(first + 1);
  const node = nodesById.get(id);
  if (node instanceof RemoteElement) {
    const listener = node._listeners.get(key);
    if (listener) {
      try {
        listener(data);
      } catch (error) {
        (globalThis as { lynx?: { reportError?(e: unknown): void } }).lynx
          ?.reportError?.(error);
      }
    }
  }
}

function boot(): RemoteElement {
  if (container) {
    return container;
  }

  // Vanilla preact resolves `document` from the global scope.
  (globalThis as { document?: unknown }).document ??= new RemoteDocument();

  const tt = lynxCoreInject.tt;
  tt['OnLifecycleEvent'] = () => {/* noop */};
  tt['publishEvent'] = dispatchEvent;
  tt['publicComponentEvent'] = (
    _componentId: string,
    handlerName: string,
    data: unknown,
  ) => dispatchEvent(handlerName, data);
  tt['updateCardData'] = () => {/* noop */};
  tt['updateGlobalProps'] = () => {/* noop */};
  tt['processCardConfig'] = () => {/* noop */};
  tt['callDestroyLifetimeFun'] = () => {/* noop */};

  container = createPageContainer();
  return container;
}

/**
 * The page root, mirroring `root` from `@lynx-js/react`.
 *
 * @public
 */
export const root = {
  render(vnode: ComponentChild): void {
    render(vnode, boot() as unknown as HTMLElement);
  },
};
