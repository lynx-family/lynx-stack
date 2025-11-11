/*
 * Copyright 2021-2024 The Lynx Authors. All rights reserved.
 */

import { type JSRealm } from './mtsRealm.js';
import { type MainThreadGlobalThis } from '../dist/standard.js';

export class MainThreadJSBinding {
  #mtsGlobalThis: MainThreadGlobalThis | undefined;
  constructor(private mtsRealm: JSRealm, private rootDom: ShadowRoot) {
  }

  setMainThreadInstance(mtsGlobalThis: MainThreadGlobalThis) {
    this.#mtsGlobalThis = mtsGlobalThis;
  }
  runWorklet(handler: any, eventObject: any) {
    this.mtsRealm.globalWindow.runWorklet?.(handler, eventObject);
  }

  enableEvent(eventName: string) {
    if (this.#mtsGlobalThis) {
      this.rootDom.addEventListener(
        eventName,
        this.#mtsGlobalThis.__WasmBindingCommonEventHandler.bind(
          this.#mtsGlobalThis,
        ),
        { capture: true, passive: true },
      );
    }
  }
}
