// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Background-thread bootstrap: installs the event bridge on
 * `lynxCoreInject.tt` and exposes the root container for preact.
 */

import { render } from 'preact';
import type { ComponentChild } from 'preact';

import { enqueueOp } from './channel.js';
import {
  RemoteDocument,
  RemoteElement,
  createPageContainer,
  nodesById,
} from './document.js';
import { BackgroundMainThreadElement } from './mainThreadElement.js';
import * as Ops from './ops.js';

declare const lynxCoreInject: {
  tt: Record<string, unknown>;
};

(globalThis as { __TRANSFORM_FREE_MTS__?: boolean }).__TRANSFORM_FREE_MTS__ =
  true;

const reportError = (message: string) => {
  enqueueOp([Ops.ReportError, message]);
};
{
  const target = globalThis as unknown as {
    addEventListener?: (
      type: string,
      cb: (e: Record<string, unknown>) => void,
    ) => void;
  };
  target.addEventListener?.('error', (e) => {
    const error = e['error'] as Error | undefined;
    const message = e['message'];
    reportError(
      error?.stack ?? error?.message
        ?? (typeof message === 'string' ? message : ''),
    );
  });
  target.addEventListener?.('unhandledrejection', (e) => {
    reportError(`unhandledrejection: ${
      String(
        (e['reason'] as Error | undefined)?.stack ?? e['reason'],
      )
    }`);
  });
}

let container: RemoteElement | undefined;

function dispatchEvent(handlerName: string, data: unknown): void {
  // handlerName format: `${id}:${eventType}:${eventName}`
  const first = handlerName.indexOf(':');
  const id = Number(handlerName.slice(0, first));
  const key = handlerName.slice(first + 1);
  const node = nodesById.get(id);
  if (node instanceof RemoteElement) {
    const mtListener = node._mtListeners.get(key);
    if (mtListener) {
      const wrapped = new BackgroundMainThreadElement(node);
      const event = data && typeof data === 'object'
        ? Object.assign({}, data, { currentTarget: wrapped, target: wrapped })
        : data;
      try {
        mtListener(event);
      } catch (error) {
        (globalThis as { lynx?: { reportError?(e: unknown): void } }).lynx
          ?.reportError?.(error);
      }
    }
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
    const container = boot();
    try {
      render(vnode, container as unknown as HTMLElement);
    } catch (error) {
      enqueueOp([
        Ops.ReportError,
        String((error as Error | undefined)?.stack ?? error),
      ]);
      throw error;
    }
  },
};
