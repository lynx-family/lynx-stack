// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { display, position, textDecoration } from './plugins/lynx/index.js';

/**
 * Should be used with Tailwind JIT and configured with purge, otherwise the bundle will be too large.
 */
export default {
  content: ['./**/*.{js,ts,jsx,tsx,css}'],
  plugins: [position, textDecoration, display],
  corePlugins: [
    // 'preflight',
    'alignContent',
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

    'boxShadow',
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
    'inset',

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
    'outline',
    'overflow',

    'padding',
    // 'position', // Defined using plugin
    'zIndex',

    'textAlign',
    // 'textDecoration', // Replaced with plugin
    'textOverflow',

    'transformOrigin',
    'transform',
    'transitionDelay',
    'transitionDuration',
    'transitionProperty',
    'transitionTimingFunction',

    'translate',
    'rotate',
    'scale',
    'skew',

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
};

// Tailwind un-configured corePlugins
// 'container'

// 'accessibility'
// 'pointerEvents'

// 'isolation'

// 'float'
// 'clear'

// 'tableLayout'
// 'borderCollapse'

// 'animation'

// 'cursor'
// 'userSelect'
// 'resize'

// 'listStylePosition'
// 'listStyleType'

// 'appearance'

// 'placeContent'
// 'placeItems'

// 'justifyItems'
// 'gap'
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
