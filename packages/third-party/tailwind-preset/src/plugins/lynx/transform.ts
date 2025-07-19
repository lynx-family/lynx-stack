// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createPlugin } from '../../helpers.js';
import type { Plugin } from '../../helpers.js';
import type { CSSRuleObject } from '../../types/tailwind-types.js';

export type TransformKey =
  | 'translateX'
  | 'translateY'
  | 'translateZ'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'skewX'
  | 'skewY'
  | 'scaleX'
  | 'scaleY';

export const cssTransformVarMap: Record<TransformKey, string> = {
  translateX: '--tw-tx',
  translateY: '--tw-ty',
  translateZ: '--tw-tz',
  rotateX: '--tw-rx',
  rotateY: '--tw-ry',
  rotateZ: '--tw-rz',
  skewX: '--tw-skx',
  skewY: '--tw-sky',
  scaleX: '--tw-sx',
  scaleY: '--tw-sy',
};

export const cssTransformDefault: Record<string, string> = {
  '--tw-tx': '0',
  '--tw-ty': '0',
  '--tw-tz': '0',
  '--tw-rx': '0',
  '--tw-ry': '0',
  '--tw-rz': '0',
  '--tw-skx': '0',
  '--tw-sky': '0',
  '--tw-sx': '1',
  '--tw-sy': '1',
};

/*
 * These variables are layered into `transform: ...` via customized transform utility:
 *     transform: translate3d(var(--tw-tx), var(--tw-ty), var(--tw-tz))
 *                rotateX(var(--tw-rx)) rotateY(var(--tw-ry)) rotateZ(var(--tw-rz))
 *                skew(var(--tw-skx), var(--tw-sky))
 *                scale(var(--tw-sx), var(--tw-sy));
 */

export const cssTransformValue: string = [
  `translate3d(var(${cssTransformVarMap.translateX}), var(${cssTransformVarMap.translateY}), var(${cssTransformVarMap.translateZ}))`,
  `rotateX(var(${cssTransformVarMap.rotateX}))`,
  `rotateY(var(${cssTransformVarMap.rotateY}))`,
  `rotateZ(var(${cssTransformVarMap.rotateZ}))`,
  `skew(var(${cssTransformVarMap.skewX}), var(${cssTransformVarMap.skewY}))`,
  `scale(var(${cssTransformVarMap.scaleX}), var(${cssTransformVarMap.scaleY}))`,
].join(' ');

export const transform: Plugin = createPlugin(
  ({ addUtilities, matchUtilities }) => {
    addUtilities(
      {
        '.transform': { transform: cssTransformValue },
        '.transform-cpu': {
          transform: cssTransformValue,
        },
        '.transform-gpu': {
          transform: cssTransformValue,
        },
        '.transform-none': { transform: 'none' },
      },
    );
    matchUtilities({
      transform: (value: unknown) => {
        if (typeof value !== 'string') {
          return null;
        }
        const result: CSSRuleObject = {
          transform: value,
        };
        return result;
      },
    });
  },
);

/* Abbreviated Tailwind Transform Variables
 *
 * These custom properties follow a shortened naming convention to simplify transform-related
 * values used in animation utilities and component transitions.
 *
 * ┌──────────────┬──────────────┬────────────────────────────────────┐
 * │ Full Name    │ Abbreviation │ Description                        │
 * ├──────────────┼──────────────┼────────────────────────────────────┤
 * │ translate-x  │ --tw-tx      │ Horizontal translation             │
 * │ translate-y  │ --tw-ty      │ Vertical translation               │
 * │ translate-z  │ --tw-tz      │ Depth translation (if 3D enabled)  │
 * │ rotate       │ --tw-rz      │ Rotation around Z axis
 * | rotate-z     │ --tw-rz      │ Rotation around Z axis             │
 * │ rotate-x     │ --tw-rx      │ Rotation around X axis             │
 * │ rotate-y     │ --tw-ry      │ Rotation around Y axis             │
 * │ skew-x       │ --tw-skx     │ Skew along the X axis              │
 * │ skew-y       │ --tw-sky     │ Skew along the Y axis              │
 * │ scale-x      │ --tw-sx      │ Scale along the X axis             │
 * │ scale-y      │ --tw-sy      │ Scale along the Y axis             │
 * └──────────────┴──────────────┴────────────────────────────────────┘
 *
 * Notes:
 * - `sx`/`sy` are reserved for `scale`, following established graphics conventions.
 * - `skx`/`sky` are used for skew to avoid collision and confusion.
 * - All variables are initialized as follows:
 *     --tw-tx: 0;
 *     --tw-ty: 0;
 *     --tw-tz: 0;
 *     --tw-rx: 0;
 *     --tw-ry: 0;
 *     --tw-rz: 0;
 *     --tw-skx: 0;
 *     --tw-sky: 0;
 *     --tw-sx: 1;
 *     --tw-sy: 1;
 * */
