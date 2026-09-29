// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createCompiledTemplateFactory, setProp } from './renderer.js';
import type { SolidLynxNode } from './renderer.js';

/**
 * A factory for one build-time compiled Lynx Element Template fragment.
 *
 * @public
 */
export interface SolidLynxTemplateFactory {
  (): SolidLynxNode;
  cloneNode(deep?: boolean): SolidLynxNode;
}

/**
 * Creates a factory backed by precompiled Lynx Element Template metadata.
 *
 * @public
 */
export function createTemplate(
  templateKey: string,
): SolidLynxTemplateFactory {
  return createCompiledTemplateFactory(templateKey);
}

/**
 * Updates an attribute emitted by Solid's DOM compiler.
 *
 * @public
 */
export function setAttribute(
  node: SolidLynxNode,
  name: string,
  value: unknown,
): void {
  setProp(node, name, value);
}

/** @public */
export const setProperty: typeof setAttribute = setAttribute;

/** @public */
export function className(
  node: SolidLynxNode,
  value: unknown,
): void {
  setProp(node, 'class', value);
}
