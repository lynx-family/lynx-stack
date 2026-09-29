// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export {
  createElement,
  createTextNode,
  insert,
  insertTemplateChild,
  insertNode,
  memo,
  setProp,
  setTemplateAttribute,
  setTemplateText,
  spread,
  spreadTemplateAttributes,
  use,
} from './renderer.js';
export type { SolidLynxNode, SolidLynxRendererContext } from './renderer.js';
export {
  className,
  createTemplate,
  setAttribute,
  setProperty,
} from './template.js';
export type { SolidLynxTemplateFactory } from './template.js';
