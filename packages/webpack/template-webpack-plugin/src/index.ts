// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * @packageDocumentation
 *
 * A webpack plugin that simplifies creation of `template.js` files to serve your bundles.
 */

export { LynxTemplatePlugin } from './LynxTemplatePlugin.js';
export type {
  LynxTemplatePluginOptions,
  TemplateHooks,
  EncodeOptions,
} from './LynxTemplatePlugin.js';
export { LynxEncodePlugin } from './LynxEncodePlugin.js';
export type { LynxEncodePluginOptions } from './LynxEncodePlugin.js';
export { WebEncodePlugin } from './WebEncodePlugin.js';
export * as CSSPlugins from './css/plugins/index.js';
export * as CSS from './css/index.js';
