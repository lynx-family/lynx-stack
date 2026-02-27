// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Cloneable } from './Cloneable.js';
import type { LynxEventType } from './EventType.js';
import type { PageConfig } from './PageConfig.js';
import type { StyleInfo } from './StyleInfo.js';

export type ElementTemplateData = {
  id: string;
  type: string;
  idSelector?: string;
  class?: string[];
  attributes?: Record<string, string>;
  builtinAttributes?: Record<string, string>;
  children?: ElementTemplateData[];
  events?: { type: LynxEventType; name: string; value: string }[];
  dataset?: Record<string, string>;
};

export interface LynxTemplate {
  styleInfo: StyleInfo;
  pageConfig: PageConfig;
  customSections: {
    [key: string]: {
      type?: 'lazy';
      content: Cloneable;
    };
  };
  cardType?: string;
  lepusCode: {
    root: string;
    [key: string]: string;
  };
  manifest: {
    '/app-service.js': string;
    [key: string]: string;
  };
  elementTemplate: Record<string, ElementTemplateData[]>;
  version?: number;
  appType: 'card' | 'lazy';
}

export type BTSChunkEntry = (
  postMessage: undefined,
  module: { exports: unknown },
  exports: unknown,
  lynxCoreInject: unknown,
  Card: unknown,
  setTimeout: unknown,
  setInterval: unknown,
  clearInterval: unknown,
  clearTimeout: unknown,
  NativeModules: unknown,
  Component: unknown,
  ReactLynx: unknown,
  nativeAppId: unknown,
  Behavior: unknown,
  LynxJSBI: unknown,
  lynx: unknown,
  // BOM API
  window: unknown,
  document: unknown,
  frames: unknown,
  location: unknown,
  navigator: unknown,
  localStorage: unknown,
  history: unknown,
  Caches: unknown,
  screen: unknown,
  alert: unknown,
  confirm: unknown,
  prompt: unknown,
  fetch: unknown,
  XMLHttpRequest: unknown,
  webkit: unknown,
  Reporter: unknown,
  print: unknown,
  global: unknown,
  // Lynx API
  requestAnimationFrame: unknown,
  cancelAnimationFrame: unknown,
) => unknown;

export interface LynxJSModule {
  exports?: (lynx_runtime: any) => unknown;
}
