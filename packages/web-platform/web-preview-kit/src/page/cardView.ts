// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxViewElement } from '@lynx-js/web-core/client';

import type { PreviewData } from '../protocol.js';
import type { CardHost, DevServerMessage } from './session.js';

/** What a card asks the page for. */
export interface CardViewCallbacks {
  /** The card's HMR client could not apply an update and asks to reload. */
  onReloadRequest(): void;
  /** The card threw. */
  onError(error: { message: string; stack?: string; fileName?: string }): void;
}

/**
 * `NativeModules.LynxDevToolSetModule` for the background thread of a card:
 * the HMR client of `@lynx-js/webpack-dev-transport` calls `invokeCdp` with a
 * `Page.reload` command when it cannot apply an update. The call reaches
 * `onNativeModulesCall` of the `<lynx-view>`.
 */
const DEVTOOL_SET_MODULE_SOURCE = `
export default function(NativeModules, NativeModulesCall) {
  return {
    invokeCdp(message, callback) {
      Promise.resolve(NativeModulesCall('invokeCdp', message)).then(
        (result) => { if (typeof callback === 'function') callback(result); },
        (error) => {
          if (typeof callback === 'function') {
            callback(JSON.stringify({ error: { code: -1, message: String(error) } }));
          }
        },
      );
    },
  };
}
`;

export const DEVTOOL_SET_MODULE = 'LynxDevToolSetModule';

/** Renders the previewed card in a `<lynx-view>` inside `container`. */
export class CardView implements CardHost {
  readonly #container: HTMLElement;
  readonly #callbacks: CardViewCallbacks;
  readonly #devtoolModuleUrl = URL.createObjectURL(
    new Blob([DEVTOOL_SET_MODULE_SOURCE], { type: 'text/javascript' }),
  );
  #view: LynxViewElement | undefined;

  constructor(container: HTMLElement, callbacks: CardViewCallbacks) {
    this.#container = container;
    this.#callbacks = callbacks;
  }

  load(url: string, data: PreviewData): void {
    const view = document.createElement('lynx-view') as LynxViewElement;
    view.setAttribute('part', 'card');
    view.className = 'card';
    view.nativeModulesMap = { [DEVTOOL_SET_MODULE]: this.#devtoolModuleUrl };
    view.onNativeModulesCall = (name, message, moduleName) => {
      if (view !== this.#view) {
        return undefined;
      }
      if (moduleName === DEVTOOL_SET_MODULE && name === 'invokeCdp') {
        return this.#invokeCdp(String(message));
      }
      return undefined;
    };
    view.addEventListener('error', (event) => {
      if (view === this.#view) {
        this.#callbacks.onError(describeError(event));
      }
    });
    if (data.initData !== undefined) {
      view.initData = data.initData as LynxViewElement['initData'];
    }
    if (data.globalProps !== undefined) {
      view.globalProps = data.globalProps as LynxViewElement['globalProps'];
    }
    view.url = url;
    const previous = this.#view;
    this.#view = view;
    if (previous) {
      previous.replaceWith(view);
    } else {
      this.#container.append(view);
    }
  }

  clear(): void {
    this.#view?.remove();
    this.#view = undefined;
  }

  setData(data: PreviewData): void {
    const view = this.#view;
    if (!view) {
      return;
    }
    if (data.initData !== undefined) {
      view.updateData(data.initData as LynxViewElement['initData']);
    }
    if (data.globalProps !== undefined) {
      view.updateGlobalProps(
        data.globalProps as LynxViewElement['globalProps'],
      );
    }
  }

  sendDevServerMessage(message: DevServerMessage): void {
    // `LynxTransportClient` of `@lynx-js/webpack-dev-transport` reads
    // `event.data.message` as a CDP message whose `params.data` is the
    // dev-server message, as a Lynx DevTool sends it. `sendDevtoolEvent` is
    // typed to take a string, but its `data` is handed to the background
    // thread as the event's `data` unchanged, so it has to be this object.
    const data = {
      type: 'message',
      message: JSON.stringify({
        method: 'message',
        params: { data: JSON.stringify(message) },
      }),
    };
    this.#view?.sendDevtoolEvent('message', data as unknown as string);
  }

  #invokeCdp(message: string): string {
    let request: { id?: number; method?: string } = {};
    try {
      request = JSON.parse(message) as typeof request;
    } catch {
      // answered below
    }
    if (request.method === 'Page.reload') {
      // Reload after answering, so the old card gets its callback first.
      setTimeout(() => this.#callbacks.onReloadRequest(), 0);
      return JSON.stringify({ id: request.id, result: {} });
    }
    return JSON.stringify({
      id: request.id,
      error: { code: -32601, message: `${request.method} is not supported.` },
    });
  }
}

function describeError(
  event: Event,
): { message: string; stack?: string; fileName?: string } {
  const detail = (event as CustomEvent<unknown>).detail as
    | { error?: unknown; fileName?: unknown }
    | undefined;
  const error = detail?.error;
  const fileName = typeof detail?.fileName === 'string'
    ? detail.fileName
    : undefined;
  let message: string;
  let stack: string | undefined;
  if (error instanceof Error) {
    message = error.message;
    stack = error.stack;
  } else if (
    typeof error === 'object' && error !== null && 'message' in error
  ) {
    message = String((error as { message: unknown }).message);
    const errorStack = (error as { stack?: unknown }).stack;
    stack = typeof errorStack === 'string' ? errorStack : undefined;
  } else {
    message = String(error ?? 'Unknown error');
  }
  return {
    message,
    ...(stack === undefined ? {} : { stack }),
    ...(fileName === undefined ? {} : { fileName }),
  };
}
