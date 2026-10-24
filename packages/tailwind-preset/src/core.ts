// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import {
  LYNX_PLUGIN_MAP,
  ORDERED_LYNX_PLUGIN_NAMES,
  REPLACEABLE_LYNX_PLUGINS,
} from './plugins/lynx/plugin-registry.js';
import type { LynxPluginName } from './plugins/lynx/plugin-types.js';
import {
  LYNX_UI_PLUGIN_MAP,
  ORDERED_LYNX_UI_PLUGIN_NAMES,
} from './plugins/lynx-ui/plugin-registry.js';
import type {
  LynxUIPluginName,
  LynxUIPluginOptionsMap,
} from './plugins/lynx-ui/plugin-registry.js';
import type { CorePluginsConfig } from './types/tailwind-types.js';

/* -----------------------------------------------------------------------------
 * Tailwind Core Plugin Map
 * -------------------------------------------------------------------------- */

export const DEFAULT_CORE_PLUGINS: CorePluginsConfig = [
  // 'preflight',

  'animation',
  'aspectRatio',

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

  'borderRadius',
  'borderWidth',
  'borderStyle',
  'borderColor',

  // 'boxShadow',  // Defined using plugin
  'boxSizing',
  'caretColor',

  'textColor',

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

  // 'transitionDelay', // Defined using plugin
  // 'transitionDuration', // Defined using plugin
  // 'transitionProperty', // Defined using plugin
  // 'transitionTimingFunction', // Defined using plugin

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
  // 'blur' // Defined using plugin
  // 'grayscale' // Defined using plugin
  // 'filter' // Defined using plugin
];

/* -----------------------------------------------------------------------------
 * Lynx Customized Plugins
 * -----------------------------------------------------------------------------*/

/* ---------- helper: normalize user option ----------------------- */
export type LynxPluginsOption =
  | boolean // true → all, false → none
  | LynxPluginName[] // allowed array
  | Partial<Record<LynxPluginName, boolean>>; // granular on/off

export type LynxUIPluginsOption =
  | boolean
  | LynxUIPluginName[]
  | Partial<
    {
      [K in LynxUIPluginName]: boolean | LynxUIPluginOptionsMap[K];
    }
  >;

export function toEnabledSet(
  opt: LynxPluginsOption = true,
): Set<LynxPluginName> {
  if (opt === true) return new Set(REPLACEABLE_LYNX_PLUGINS); // all
  if (opt === false) return new Set(); // none
  if (Array.isArray(opt)) return new Set(opt); // allowed array

  // Object form: all plugins enabled unless explicitly disabled
  const set = new Set(REPLACEABLE_LYNX_PLUGINS);
  for (const [k, on] of Object.entries(opt)) {
    if (on === false) set.delete(k as LynxPluginName); // explicitly disabled
    else if (on === true) set.add(k as LynxPluginName); // redundant but harmless
  }
  return set;
}

export function resolveUIPluginEntries(
  raw: LynxUIPluginsOption,
): {
  [K in LynxUIPluginName]: [K, LynxUIPluginOptionsMap[K] | undefined];
}[LynxUIPluginName][] {
  if (raw === false) return []; // Entire category switched off
  if (raw === true) {
    // Enable every plugin with default options `{}`
    return ORDERED_LYNX_UI_PLUGIN_NAMES.map(n => [n, {}]);
  }
  //  Array form – allow certain plugins, still default `{}`
  if (Array.isArray(raw)) {
    return ORDERED_LYNX_UI_PLUGIN_NAMES
      .filter(n => raw.includes(n))
      .map(n => [n, {}]);
  }
  // Object form – may contain booleans or explicit option objects
  const out: {
    [K in LynxUIPluginName]: [K, LynxUIPluginOptionsMap[K] | undefined];
  }[LynxUIPluginName][] = [];
  for (const name of ORDERED_LYNX_UI_PLUGIN_NAMES) {
    const val = raw[name];
    if (val === false) continue; // explicitly disabled
    if (val === true || val === undefined) { // enabled, but no custom opts
      out.push([name, {}]);
    } else {
      out.push([name, val]); // enabled with user options
    }
  }
  return out;
}

/* ---------- tiny public helpers --------------------------------- */
export const getReplaceablePlugins = (): readonly LynxPluginName[] =>
  REPLACEABLE_LYNX_PLUGINS;
export const isPluginReplaceable = (p: string): p is LynxPluginName =>
  p !== 'defaults' && p in LYNX_PLUGIN_MAP;

/* ---------- exports ------------- */

export type { LynxPluginName, LynxUIPluginName, LynxUIPluginOptionsMap };

export {
  LYNX_PLUGIN_MAP,
  ORDERED_LYNX_PLUGIN_NAMES,
  LYNX_UI_PLUGIN_MAP,
  ORDERED_LYNX_UI_PLUGIN_NAMES,
};

/* ---------- Tailwind core plugins pending preset integration ------------------ */

/**
 * Text-decoration plugins requiring tailored integration with the current
 * shorthand-based Lynx implementation.
 */

// 'textDecorationColor' // Longhand supported; minimum SDK is undocumented
// 'textDecorationThickness' // Longhand supported on Android and iOS in SDK 4.0+
// 'textDecorationStyle' // Longhand unsupported; available only via shorthand

/**
 * Filter functions available in Lynx SDK 3.6+ requiring Lynx replacements.
 */

// 'brightness'
// 'contrast'
// 'saturate'

/**
 * Runtime-backed candidates requiring target and semantic validation.
 */

// 'hyphens' // `manual` and `none` have the same behavior on Android and iOS
// 'pointerEvents' // Native SDK 3.5+ and Clay; unavailable on Lynx for Web
// 'cursor' // Lynx for Web and partial desktop Clay support only

/**
 * Place utilities require Lynx replacements that expand the unsupported
 * shorthands into align and justify longhands with a reduced value set.
 */

// 'placeContent'
// 'placeItems'
// 'placeSelf'

/**
 * Variable-composed effects requiring SDK 3.6+ preset integration and
 * runtime validation.
 */

// 'gradientColorStops'
// 'boxShadowColor'
// 'ringWidth'
// 'ringColor'
// 'ringOffsetWidth'
// 'ringOffsetColor'

/**
 * Sibling-based utilities requiring cross-platform selector validation.
 * Reverse spacing and divide widths additionally require SDK 3.6+ variable
 * composition.
 */

// 'space'
// 'divideWidth'
// 'divideStyle'
// 'divideColor'

/**
 * Legacy color-opacity compatibility candidates
 *
 * Tailwind CSS v3 recommends slash opacity modifiers such as `bg-black/25`
 * instead of these variable-based utilities. No preset implementation is
 * currently planned unless compatibility requires these aliases.
 */

// 'backgroundOpacity'
// 'borderOpacity'
// 'divideOpacity'
// 'placeholderOpacity'
// 'ringOpacity'
// 'textOpacity'

/* ---------- Tailwind core plugins not configured by the preset ---------------- */

/** svg-related plugins */

// 'fill'
// 'stroke'
// 'strokeWidth'

/** filter-related plugins */

// 'dropShadow'
// 'hueRotate'
// 'invert'
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

/**
 * Legacy outline definitions that are no longer maintained as Lynx CSS APIs.
 */

// 'outlineColor'
// 'outlineStyle'
// 'outlineWidth'

/** outline plugin without a corresponding Lynx CSS property */

// 'outlineOffset'

/** non-supported scroll-related plugins */

// 'overscrollBehavior'
// 'scrollBehavior',
// 'scrollMargin',
// 'scrollPadding',
// 'scrollSnapAlign',
// 'scrollSnapStop',
// 'scrollSnapType',

/** interactivity related plugins */

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

/** background and effects related plugins */

// 'backgroundAttachment'
// 'backgroundBlendMode'
// 'mixBlendMode'

/** sizing and positioning related plugins */

// 'resize'
// 'objectFit'
// 'objectPosition'
// 'borderSpacing',

/** break control related plugins */

// 'breakAfter',
// 'breakBefore',
// 'breakInside',

/** decoration and compositing related plugins */

// 'boxDecorationBreak'
// 'content',

/** typography and text styling related plugins */

// 'fontVariantNumeric'
// 'textTransform'
// 'fontSmoothing'
// 'textUnderlineOffset',
// 'textWrap',
// 'lineClamp',

/** accessibility related plugins */

// 'accessibility'
// 'forcedColorAdjust',
