/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The JS binding for the WASM main thread context instance.
 */
export type RustMainthreadContextBinding = {
  runWorklet(
    handler: any,
    eventObject: any,
    target: HTMLElement,
    currentTarget: HTMLElement,
  ): void;

  publishEvent(
    handlerName: string,
    eventData: any,
    target: HTMLElement,
    currentTarget: HTMLElement,
  ): void;

  publicComponentEvent(
    componentId: string,
    eventName: string,
    eventData: any,
    target: HTMLElement,
    currentTarget: HTMLElement,
  ): void;

  addEventListener(event_name: string): void;
};
