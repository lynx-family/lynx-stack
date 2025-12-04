/*
 * Copyright 2021-2024 The Lynx Authors. All rights reserved.
 */

import { type JSRealm } from './mtsRealm.js';
import { MainThreadWasmContext } from './wasm.js';
import { createCrossThreadEvent } from './elementAPIs/createCrossThreadEvent.js';
import type {
  LynxCrossThreadEvent,
  LynxCrossThreadEventTarget,
  MinimalRawEventObject,
  DecoratedHTMLElement,
} from '@types';
import { uniqueIdSymbol, LynxEventNameToW3cCommon } from '@constants';

export class MainThreadJSBinding {
  #wasmContext: InstanceType<typeof MainThreadWasmContext> | undefined;
  constructor(private mtsRealm: JSRealm, private rootDom: ShadowRoot) {
  }

  #eventHandler = (event: Event) => {
    const bubblePath: number[] = [];
    let currentTarget = event.target as
      | DecoratedHTMLElement
      | ShadowRoot
      | null;
    while (currentTarget) {
      if (currentTarget === this.rootDom) {
        break;
      }
      bubblePath.push((currentTarget as DecoratedHTMLElement)[uniqueIdSymbol]);
      currentTarget = currentTarget.parentElement as
        | DecoratedHTMLElement
        | null;
    }
    const serializedEvent = createCrossThreadEvent(
      event as MinimalRawEventObject,
    );
    let catched = this.#wasmContext!.dispatch_event_by_path(
      new Uint32Array(bubblePath.reverse()),
      serializedEvent.type,
      true,
      event.target as HTMLElement,
      serializedEvent,
    );
    if (catched) {
      return;
    }
    this.#wasmContext!.dispatch_event_by_path(
      new Uint32Array(bubblePath.reverse()),
      serializedEvent.type,
      false,
      event.target as HTMLElement,
      serializedEvent,
    );
  };

  #generateTargetObject(
    element: DecoratedHTMLElement,
  ): LynxCrossThreadEventTarget {
    const uniqueId = element[uniqueIdSymbol];
    return {
      dataset: this.#wasmContext!.__GetDataset(uniqueId) as {
        [key: string]: string;
      },
      id: element.id || null,
      uniqueId,
    };
  }

  setMainThreadInstance(
    mtsGlobalThis: InstanceType<typeof MainThreadWasmContext>,
  ) {
    this.#wasmContext = mtsGlobalThis;
  }
  runWorklet(
    handler: unknown,
    eventObject: LynxCrossThreadEvent,
    target: HTMLElement,
    currentTarget: HTMLElement,
  ) {
    eventObject.target = this.#generateTargetObject(
      target as DecoratedHTMLElement,
    );
    eventObject.currentTarget = this.#generateTargetObject(
      currentTarget as DecoratedHTMLElement,
    );
    // @ts-expect-error
    eventObject.target.elementRefptr = target;
    // @ts-expect-error
    eventObject.currentTarget.elementRefptr = currentTarget;
    // @ts-expect-error
    this.mtsRealm.globalWindow.runWorklet?.(handler, [eventObject]);
  }

  publicComponentEvent(
    componentId: string,
    hname: string,
    eventObject: LynxCrossThreadEvent,
    target: HTMLElement,
    currentTarget: HTMLElement,
  ) {
    eventObject.target = this.#generateTargetObject(
      target as DecoratedHTMLElement,
    );
    eventObject.currentTarget = this.#generateTargetObject(
      currentTarget as DecoratedHTMLElement,
    );
  }
  publishEvent(
    eventName: string,
    eventObject: LynxCrossThreadEvent,
    target: HTMLElement,
    currentTarget: HTMLElement,
  ) {
    eventObject.target = this.#generateTargetObject(
      target as DecoratedHTMLElement,
    );
    eventObject.currentTarget = this.#generateTargetObject(
      currentTarget as DecoratedHTMLElement,
    );
  }

  enableEvent(eventName: string) {
    const htmlEventName = LynxEventNameToW3cCommon[eventName] || eventName;
    this.rootDom.addEventListener(
      htmlEventName,
      this.#eventHandler,
      { capture: true, passive: true },
    );
  }
}
