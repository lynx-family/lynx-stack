// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { LynxThemeConfig } from './types/theme-types.js';

export const lynxTheme: Partial<LynxThemeConfig> & {
  extend?: Partial<LynxThemeConfig>;
} = {
  boxShadow: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    DEFAULT:
      '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl:
      '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
    none: 'none',
  },
  zIndex: {
    // value 'auto' is not allowed
    // auto: 'auto',
    0: '0',
    10: '10',
    20: '20',
    30: '30',
    40: '40',
    50: '50',
  },
  gridTemplateColumns: {
    1: 'repeat(1, minmax(0, 1fr))',
    2: 'repeat(2, minmax(0, 1fr))',
    3: 'repeat(3, minmax(0, 1fr))',
    4: 'repeat(4, minmax(0, 1fr))',
    5: 'repeat(5, minmax(0, 1fr))',
    6: 'repeat(6, minmax(0, 1fr))',
    7: 'repeat(7, minmax(0, 1fr))',
    8: 'repeat(8, minmax(0, 1fr))',
    9: 'repeat(9, minmax(0, 1fr))',
    10: 'repeat(10, minmax(0, 1fr))',
    11: 'repeat(11, minmax(0, 1fr))',
    12: 'repeat(12, minmax(0, 1fr))',
    // Below are not supported in Lynx
    // none: 'none',
    // subgrid: 'subgrid',
  },
  gridTemplateRows: {
    1: 'repeat(1, minmax(0, 1fr))',
    2: 'repeat(2, minmax(0, 1fr))',
    3: 'repeat(3, minmax(0, 1fr))',
    4: 'repeat(4, minmax(0, 1fr))',
    5: 'repeat(5, minmax(0, 1fr))',
    6: 'repeat(6, minmax(0, 1fr))',
    7: 'repeat(7, minmax(0, 1fr))',
    8: 'repeat(8, minmax(0, 1fr))',
    9: 'repeat(9, minmax(0, 1fr))',
    10: 'repeat(10, minmax(0, 1fr))',
    11: 'repeat(11, minmax(0, 1fr))',
    12: 'repeat(12, minmax(0, 1fr))',
    // Below are not supported in Lynx
    // none: 'none',
    // subgrid: 'subgrid',
  },
  gridAutoColumns: {
    auto: 'auto',
    max: 'max-content',
    fr: 'minmax(0, 1fr)',
    // Not supported in Lynx
    // min: 'min-content',
  },
  gridAutoRows: {
    auto: 'auto',
    max: 'max-content',
    fr: 'minmax(0, 1fr)',
    // Not supported in Lynx
    // min: 'min-content',
  },
  aspectRatio: {
    square: '1 / 1',
    video: '16 / 9',
    // Not supported in Lynx
    // auto: 'auto',
  },
  perspective: {
    auto: 'auto',
    dramatic: '100px',
    near: '300px',
    normal: '500px',
    midrange: '800px',
    distant: '1200px',
  },
  transitionProperty: {
    // fill, stroke, backdrop-filter, box-shadow, text-decoration-color cannot be animated in Lynx
    none: 'none',
    all: 'all',
    DEFAULT: 'background-color, opacity, transform, border-color, color',
    colors: 'background-color, border-color, color',
    opacity: 'opacity',
    transform: 'transform',
    color: 'color',
    filter: 'filter',
    'background-color': 'background-color',
    'border-color': 'border-color',
  },
  extend: {
    transitionDuration: {
      DEFAULT: '150ms',
    },
    transitionTimingFunction: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
    grayscale: {
      none: '',
      25: '25%',
      50: '50%',
      75: '75%',
    },
  },
};
