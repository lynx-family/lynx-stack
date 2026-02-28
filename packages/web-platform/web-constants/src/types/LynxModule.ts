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

/**
 * Represents a Lynx Bundle — the compiled artifact containing all necessary
 * resources (stylesheet, scripts, serialized element tree) for a Lynx
 * application to run.
 *
 * @remarks
 * This interface corresponds to the "Bundle" concept in the official Lynx
 * specification. The name `LynxTemplate` is a legacy artifact.
 *
 * @deprecated Use {@link LynxBundle} instead. This alias is retained for
 * backward compatibility.
 */
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
  /**
   * Main Thread Script (MTS) — code that runs on the main thread (UI thread).
   *
   * @remarks
   * In the official Lynx specification this is called "Main Thread Script"
   * (MTS). The field name `lepusCode` is a legacy artifact that cannot be
   * renamed as it is part of the wire format.
   */
  lepusCode: {
    root: string;
    [key: string]: string;
  };
  /**
   * Background Thread Script (BTS) — code that runs on the background thread.
   *
   * @remarks
   * In the official Lynx specification this is called "Background Thread
   * Script" (BTS). The field name `manifest` is a legacy artifact that cannot
   * be renamed as it is part of the wire format. The key `'/app-service.js'`
   * is a conventional entry point name for BTS.
   */
  manifest: {
    '/app-service.js': string;
    [key: string]: string;
  };
  elementTemplate: Record<string, ElementTemplateData[]>;
  version?: number;
  appType: 'card' | 'lazy';
}

/**
 * Represents a Lynx Bundle — the compiled artifact containing all necessary
 * resources (stylesheet, scripts, serialized element tree) for a Lynx
 * application to run.
 *
 * This is the preferred name for the type previously known as
 * {@link LynxTemplate}.
 */
export type LynxBundle = LynxTemplate;

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
