// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable import/export -- Runtime exports override type-only Solid declarations. */

import { renderSolidLynxInitial } from './mainThreadRenderer.js';
import { createRoot as createLynxRoot } from './root.js';
import type { Root } from './root.js';

export type * from 'solid-js';
export {
  batch,
  createComponent,
  createComputed,
  createEffect,
  createMemo,
  createReaction,
  createRoot,
  createRenderEffect,
  createSignal,
  effect,
  For,
  Show,
  untrack,
} from './mainThreadSignals.js';
export {
  className,
  createElement,
  createTemplate,
  createTextNode,
  insert,
  insertNode,
  insertTemplateChild,
  memo,
  setAttribute,
  setProp,
  setProperty,
  setTemplateAttribute,
  setTemplateText,
  spread,
  spreadTemplateAttributes,
  use,
} from './mainThreadRenderer.js';
export type { JSX } from './jsx.js';
export type { SolidLynxNode, SolidLynxRendererContext } from './renderer.js';
export type { Root } from './root.js';

export const root: Root = createLynxRoot(
  'main-thread',
  renderSolidLynxInitial,
);
