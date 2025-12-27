/*
 * Copyright 2023 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LynxEventType } from './EventType.js';

export type ElementTemplateData = {
  type: string;
  idSelector?: string;
  class?: string[];
  attributes?: Record<string, string>;
  builtinAttributes?: Record<string, string>;
  children?: ElementTemplateData[];
  events?: { type: LynxEventType; name: string; value: string }[];
  dataset?: Record<string, string>;
};
