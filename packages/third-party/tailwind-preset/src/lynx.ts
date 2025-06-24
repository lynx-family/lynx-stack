// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Config } from 'tailwindcss';

import {
  alignContent,
  boxShadow,
  defaults,
  direction,
  display,
  inset,
  overflow,
  position,
  rotate,
  scale,
  skew,
  textAlign,
  textDecoration,
  transform,
  translate,
} from './plugins/lynx/index.js';
import { lynxTheme } from './theme.js';

/**
 * Should be used with Tailwind v3+ (JIT is enabled by default) and configured with `content`,
 * otherwise the generated CSS bundle may include unused utilities.
 */

const preset: Partial<Config> = {
  plugins: [
    defaults,
    display,
    position,
    textDecoration,
    inset,
    alignContent,
    transform,
    translate,
    rotate,
    skew,
    scale,
    textAlign,
    direction,
    overflow,
    boxShadow,
  ],
  corePlugins: [
    // 'preflight',

    // 'alignContent', // Defined using plugin
    'alignItems',
    'alignSelf',

    // 'animation',

    // 'aspectRatio',

    'backgroundClip',
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
    // 'content',

    // 'display', // Defined using plugin
    'flexDirection',
    'flexGrow',
    'flexShrink',
    'flexWrap',
    'flex',

    'fontFamily',
    'fontSize',
    'fontStyle',
    'fontWeight',

    'height',
    // 'inset',

    'justifyContent',

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

    'visibility',
    'whitespace',
    'wordBreak',

    'gridColumn',
    'gridColumnStart',
    'gridColumnEnd',
    'gridRow',
    'gridRowStart',
    'gridRowEnd',

    'gridAutoColumns',
    'gridAutoFlow',
    'gridAutoRows',
    'gridTemplateColumns',
    'gridTemplateRows',
    'gap',
  ],
  theme: lynxTheme,
};

export default preset;

// Tailwind un-configured corePlugins
// 'container'

// 'accessibility'
// 'pointerEvents'

// 'isolation'

// 'float'
// 'clear'

// 'tableLayout'
// 'borderCollapse'

// 'cursor'
// 'userSelect'
// 'resize'

// 'listStylePosition'
// 'listStyleType'

// 'appearance'

// 'placeContent'
// 'placeItems'

// 'justifyItems'
// 'space'
// 'divideWidth'
// 'divideStyle'
// 'divideColor'
// 'divideOpacity'

// 'placeSelf'
// 'justifySelf'

// 'overscrollBehavior'

// 'backgroundOpacity'
// 'gradientColorStops'
// 'boxDecorationBreak'
// 'backgroundAttachment'

// 'fill'
// 'stroke'
// 'strokeWidth'

// 'objectFit'
// 'objectPosition'

// 'verticalAlign'

// 'textTransform'

// 'fontVariantNumeric'

// 'textOpacity'

// 'fontSmoothing'
// 'placeholderColor'
// 'placeholderOpacity'

// 'backgroundBlendMode'
// 'mixBlendMode'

// 'ringWidth'
// 'ringColor'
// 'ringOpacity'
// 'ringOffsetWidth'
// 'ringOffsetColor'

// 'blur'
// 'brightness'
// 'contrast'
// 'dropShadow'
// 'grayscale'
// 'hueRotate'
// 'invert'
// 'saturate'
// 'sepia'
// 'filter'

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

// 'accentColor',
// 'borderOpacity',
// 'borderSpacing',
// 'boxShadowColor',
// 'breakAfter',
// 'breakBefore',
// 'breakInside',
// 'captionSide',
// 'columns',
// 'contain',
// 'flexBasis',
// 'forcedColorAdjust',
// 'hyphens',
// 'lineClamp',
// 'listStyleImage',
// 'outlineColor',
// 'outlineOffset',
// 'outlineStyle',
// 'outlineWidth',
// 'scrollBehavior',
// 'scrollMargin',
// 'scrollPadding',
// 'scrollSnapAlign',
// 'scrollSnapStop',
// 'scrollSnapType',
// 'size',
// 'textDecorationColor',
// 'textDecorationStyle',
// 'textDecorationThickness',
// 'textIndent',
// 'textUnderlineOffset',
// 'textWrap',
// 'touchAction',
// 'willChange'
