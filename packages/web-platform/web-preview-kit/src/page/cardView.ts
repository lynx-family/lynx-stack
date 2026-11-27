// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { LynxViewElement } from '@lynx-js/web-core/client';

import type { PreviewData } from '../protocol.js';

/** A message of the dev-server protocol that the HMR client of a card reads. */
export type DevServerMessage =
  | { type: 'hash'; data: string }
  | { type: 'ok' };

/**
 * `NativeModules.LynxDevToolSetModule` for the background thread of a card.
 * The HMR client of `@lynx-js/webpack-dev-transport` calls `invokeCdp` with
 * a `Page.reload` command when it cannot apply an update, and that is the
 * only call it makes. The call reaches `onNativeModulesCall` of the
 * `<lynx-view>`.
 */
const DEVTOOL_SET_MODULE_SOURCE = `
export default function(NativeModules, NativeModulesCall) {
  return {
    invokeCdp(message) {
      NativeModulesCall('invokeCdp', message);
    },
  };
}
`;

/** Renders the previewed card in a `<lynx-view>` inside `container`. */
export class CardView {
  readonly #container: HTMLElement;
  readonly #onReloadRequest: () => void;
  readonly #devtoolModuleUrl = URL.createObjectURL(
    new Blob([DEVTOOL_SET_MODULE_SOURCE], { type: 'text/javascript' }),
  );
  #view: LynxViewElement | undefined;

  constructor(container: HTMLElement, onReloadRequest: () => void) {
    this.#container = container;
    this.#onReloadRequest = onReloadRequest;
  }

  /** Loads a card from scratch, replacing the one shown. */
  load(url: string, data: PreviewData): void {
    const view = document.createElement('lynx-view') as LynxViewElement;
    view.nativeModulesMap = { LynxDevToolSetModule: this.#devtoolModuleUrl };
    view.onNativeModulesCall = () => {
      this.#onReloadRequest();
    };
    if (data.initData !== undefined) {
      view.initData = data.initData as LynxViewElement['initData'];
    }
    if (data.globalProps !== undefined) {
      view.globalProps = data.globalProps as LynxViewElement['globalProps'];
    }
    view.url = url;
    this.clear();
    this.#container.append(view);
    this.#view = view;
  }

  clear(): void {
    this.#view?.remove();
    this.#view = undefined;
  }

  /** Updates the data of the running card; omitted fields are unchanged. */
  setData(data: PreviewData): void {
    if (data.initData !== undefined) {
      this.#view?.updateData(data.initData as LynxViewElement['initData']);
    }
    if (data.globalProps !== undefined) {
      this.#view?.updateGlobalProps(
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
}
