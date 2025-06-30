// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import * as pluginModules from 'plugins/lynx';

import type { Plugin } from './helpers.js';
import type { CorePluginsConfig } from './types/tailwind-types.js';

/* -----------------------------------------------------------------------------
 * Plugin map
 * -------------------------------------------------------------------------- */

export type LynxPluginName = keyof typeof pluginModules;

export const DEFAULT_CORE_PLUGINS: CorePluginsConfig = [
  // 'preflight',
  // 'alignContent', // Defined using plugin
  'alignItems',
  'alignSelf',

  // 'backgroundClip', // Defined using plugin
  'backgroundColor',
  'backgroundImage',
  'backgroundOrigin',
  'backgroundPosition',
  'backgroundRepeat',
  'backgroundSize',
  // 'backgroundOpacity',

  'borderRadius',
  'borderWidth',
  'borderStyle',
  'borderColor',
  // 'borderOpacity',

  // 'boxShadow',  // Defined using plugin
  'boxSizing',
  'caretColor',

  'textColor',
  // 'textOpacity',
  // 'textDecorationColor',
  // 'textDecorationStyle',

  // 'display', // Defined using plugin
  'flexDirection',
  'flexGrow',
  'flexShrink',
  'flexWrap',
  'flex',
  'flexBasis',

  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',

  'height',
  // 'inset', // Defined using plugin

  // 'justifyContent', // Defined using plugin
  'justifyItems',
  'justifySelf',

  'letterSpacing',
  'lineHeight',

  'margin',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'width',

  'opacity',
  'order',
  // 'overflow', // Defined using plugin

  'padding',
  // 'position', // Defined using plugin
  'zIndex',

  // 'textAlign', // Defined using plugin
  // 'textDecoration', // Replaced with plugin
  'textIndent',
  'textOverflow',

  'transformOrigin',
  // 'transform', // Defined using plugin

  'transitionDelay',
  'transitionDuration',
  'transitionProperty',
  'transitionTimingFunction',

  // 'translate', // Defined using plugin
  // 'rotate', // Defined using plugin
  // 'scale', // Defined using plugin
  // 'skew', // Defined using plugin

  // 'visibility', // Defined using plugin
  // 'whitespace', // Defined using plugin
  // 'wordBreak', // Defined using plugin

  'verticalAlign',

  // 'gridColumn', // Defined using plugin
  'gridColumnStart',
  'gridColumnEnd',
  // 'gridRow', // Defined using plugin
  'gridRowStart',
  'gridRowEnd',

  'gridAutoColumns',
  'gridAutoFlow',
  'gridAutoRows',
  'gridTemplateColumns',
  'gridTemplateRows',
  'gap',

  'size',
  /* Plugins to be customized */
  // 'animation',
  // 'aspectRatio',
  // 'gradientColorStops'
  // 'blur'
  // 'grayscale'
  // 'filter'
  // 'accessibility'

  /* Plugins coming in next release */
  // 'fontVariantNumeric'

  /* Plugins waiting for Nested CSS Variables */
  // 'boxShadowColor',
  // 'ringWidth'
  // 'ringColor'
  // 'ringOpacity'
  // 'ringOffsetWidth'
  // 'ringOffsetColor'
  // 'space'
  // 'divideWidth'
  // 'divideStyle'
  // 'divideColor'
  // 'divideOpacity'
];

/* ---------- derived types & constants --------------------------- */
export const LYNX_PLUGIN_MAP: Record<LynxPluginName, Plugin> =
  pluginModules as Record<LynxPluginName, Plugin>;

export const REPLACEABLE_PLUGINS = Object.freeze(
  Object.keys(LYNX_PLUGIN_MAP).filter(k => k !== 'defaults'),
) as readonly LynxPluginName[];

/* ---------- helper: normalize user option ----------------------- */
export type LynxPluginsOption =
  | boolean // true → all, false → none
  | LynxPluginName[] // whitelist
  | Partial<Record<LynxPluginName, boolean>>; // granular on/off

export function toEnabledSet(
  opt: LynxPluginsOption = true,
): Set<LynxPluginName> {
  if (opt === true) return new Set(REPLACEABLE_PLUGINS); // all
  if (opt === false) return new Set(); // none
  if (Array.isArray(opt)) return new Set(opt); // whitelist array

  // object form → blacklist
  const set = new Set(REPLACEABLE_PLUGINS);
  for (const [k, on] of Object.entries(opt)) {
    if (on === false) set.delete(k as LynxPluginName); // explicitly disable
    else if (on === true) set.add(k as LynxPluginName); // redundant but harmless
  }
  return set;
}

/* ---------- tiny public helpers --------------------------------- */
export const getReplaceablePlugins = (): readonly LynxPluginName[] =>
  REPLACEABLE_PLUGINS;
export const isPluginReplaceable = (p: string): p is LynxPluginName =>
  p !== 'defaults' && p in LYNX_PLUGIN_MAP;

/* ---------- Tailwind un-configured corePlugins --------------------------------- */

/** svg-related plugins */

// 'fill'
// 'stroke'
// 'strokeWidth'

/** filter-related plugins, only gradyscale and blur are supported*/

// 'brightness'
// 'contrast'
// 'dropShadow'
// 'hueRotate'
// 'invert'
// 'saturate'
// 'sepia'

/** backdrop-related plugins */

// 'backdropBlur'
// 'backdropBrightness'
// 'backdropContrast'
// 'backdropGrayscale'
// 'backdropHueRotate'
// 'backdropInvert'
// 'backdropOpacity'
// 'backdropSaturate'
// 'backdropSepia'
// 'backdropFilter'

/** deprecated outline-related plugins */

// 'outlineColor',
// 'outlineOffset',
// 'outlineStyle',
// 'outlineWidth',

/** non-supported scroll-related plugins */

// 'overscrollBehavior'
// 'scrollBehavior',
// 'scrollMargin',
// 'scrollPadding',
// 'scrollSnapAlign',
// 'scrollSnapStop',
// 'scrollSnapType',

/** interactivity related plugins */

// 'pointerEvents'
// 'cursor'
// 'userSelect'
// 'touchAction',
// 'willChange'

/** layout and box model related plugins */

// 'container'
// 'clear'
// 'float'
// 'columns',
// 'contain',
// 'isolation'

/** table & list related plugins */

// 'borderCollapse'
// 'captionSide',
// 'listStylePosition'
// 'listStyleType'
// 'listStyleImage',
// 'tableLayout'

/** form appearance related plugins */

// 'appearance'
// 'accentColor',
// 'placeholderColor'
// 'placeholderOpacity'

/** background and effects related plugins */

// 'backgroundAttachment'
// 'backgroundBlendMode'
// 'mixBlendMode'

/** sizing and positioning related plugins */

// 'resize'
// 'objectFit'
// 'objectPosition'
// 'placeContent'
// 'placeItems'
// 'placeSelf'
// 'borderSpacing',

/** break control related plugins */

// 'breakAfter',
// 'breakBefore',
// 'breakInside',

/** decoration and compositing related plugins */

// 'boxDecorationBreak'
// 'content',
// 'forcedColorAdjust',

/** typography and text styling related plugins */

// 'textTransform'
// 'fontSmoothing'
// 'textDecorationThickness',
// 'textUnderlineOffset',
// 'textWrap',
// 'hyphens',
// 'lineClamp',
