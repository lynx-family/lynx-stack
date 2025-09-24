// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxPluginName } from './plugin-types.js';
import type { Plugin } from '../../helpers.js';

import * as P from './index.js';

/**
 * ---------------------------------------------------------------------------
 * Plugin execution order matters
 * ---------------------------------------------------------------------------
 * Some utilities must come after others to work correctly:
 *
 * • transitionDuration / transitionDelay / transitionTimingFunction
 *   rely on transitionProperty being registered first.
 *
 * Keeping all plugin names in this explicit, ordered array guarantees:
 *   1. deterministic CSS output (no Object.keys / emit order surprises);
 *   2. users can still toggle plugins by name without breaking the sequence;
 *   3. maintainability—update the order in one place only.
 */

type LynxPluginEntry = readonly [LynxPluginName, Plugin];

export const LYNX_PLUGIN_ENTRIES: readonly LynxPluginEntry[] = [
  ['defaults', P.defaults],

  ['visibility', P.visibility],
  ['display', P.display],
  ['position', P.position],
  ['inset', P.inset],

  ['perspective', P.perspective],
  ['translate', P.translate],
  ['rotate', P.rotate],
  ['skew', P.skew],
  ['scale', P.scale],
  ['transform', P.transform],

  ['soloTranslate', P.soloTranslate],
  ['soloRotate', P.soloRotate],
  ['soloSkew', P.soloSkew],
  ['soloScale', P.soloScale],

  ['gridColumn', P.gridColumn],
  ['gridRow', P.gridRow],
  ['alignContent', P.alignContent],
  ['justifyContent', P.justifyContent],

  ['overflow', P.overflow],
  ['direction', P.direction],
  ['whitespace', P.whitespace],
  ['wordBreak', P.wordBreak],
  ['textAlign', P.textAlign],
  ['textDecoration', P.textDecoration],

  ['backgroundClip', P.backgroundClip],
  ['boxShadow', P.boxShadow],
  ['blur', P.blur],
  ['grayscale', P.grayscale],
  ['filter', P.filter],

  ['transitionProperty', P.transitionProperty],
  ['transitionDelay', P.transitionDelay],
  ['transitionDuration', P.transitionDuration],
  ['transitionTimingFunction', P.transitionTimingFunction],
] as const;

/* ---------- derived constants ---------- */

export const LYNX_PLUGIN_MAP: Record<LynxPluginName, Plugin> = Object
  .fromEntries(LYNX_PLUGIN_ENTRIES) as Record<LynxPluginName, Plugin>;

export const ORDERED_LYNX_PLUGIN_NAMES: readonly LynxPluginName[] =
  LYNX_PLUGIN_ENTRIES.map(([n]) => n);

export const REPLACEABLE_LYNX_PLUGINS: readonly LynxPluginName[] =
  ORDERED_LYNX_PLUGIN_NAMES.filter(n => n !== 'defaults');
