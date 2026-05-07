// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { options } from 'preact';

import {
  BUILTIN_RAW_TEXT_TEMPLATE_KEY,
  BackgroundElementTemplateInstance,
  BackgroundElementTemplateSlot,
} from './instance.js';

export interface BackgroundElementTemplateDocument {
  createElement(type: string): BackgroundElementTemplateInstance;
  createElementNS(ns: string, type: string): BackgroundElementTemplateInstance;
  createTextNode(text: string): BackgroundElementTemplateInstance;
}

export function setupBackgroundElementTemplateDocument(): BackgroundElementTemplateDocument {
  const doc = {
    createElement(type: string): BackgroundElementTemplateInstance {
      if (type === 'slot') {
        return new BackgroundElementTemplateSlot();
      }
      return new BackgroundElementTemplateInstance(type);
    },
    createElementNS(_ns: string, type: string): BackgroundElementTemplateInstance {
      if (type === 'slot') {
        return new BackgroundElementTemplateSlot();
      }
      return new BackgroundElementTemplateInstance(type);
    },
    createTextNode(text: string): BackgroundElementTemplateInstance {
      return new BackgroundElementTemplateInstance(BUILTIN_RAW_TEXT_TEMPLATE_KEY, [text]);
    },
  };

  options.document = doc as unknown as Document;

  return doc;
}
