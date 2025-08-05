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
  class: string[];
  idSelector: string;
  attributes: Record<string, string>;
  builtinAttributes: Record<string, string>;
  children: ElementTemplateData[];
  events: { type: LynxEventType; name: string; value: string }[];
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
}

export interface LynxJSModule {
  exports?: (lynx_runtime: any) => unknown;
}
