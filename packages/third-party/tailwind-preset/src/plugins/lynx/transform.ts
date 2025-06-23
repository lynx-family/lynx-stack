// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable @typescript-eslint/unbound-method */
import { createPlugin } from '../../helpers.js';

export const cssTransformValue = [
  'translate3d(var(--tw-translate-x), var(--tw-translate-y), var(--tw-translate-z))',
  'rotateX(var(--tw-rotate-x))',
  'rotateY(var(--tw-rotate-y))',
  'rotateZ(var(--tw-rotate))',
  'skewX(var(--tw-skew-x))',
  'skewY(var(--tw-skew-y))',
  'scaleX(var(--tw-scale-x))',
  'scaleY(var(--tw-scale-y))',
].join(' ');

export const transform = createPlugin(({ addUtilities }) => {
  addUtilities(
    {
      '.transform': { '@defaults transform': {}, transform: cssTransformValue },
      '.transform-cpu': {
        transform: cssTransformValue,
      },
      '.transform-gpu': {
        transform: cssTransformValue,
      },
      '.transform-none': { transform: 'none' },
    },
  );
});
