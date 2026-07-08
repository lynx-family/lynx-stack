// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';
import { stringLikeSchema, stringifyValue } from '../utils.js';

import '../../../styles/catalog/Image.css';

export const Image = defineComponent({
  name: 'Image',
  props: z.object({
    url: stringLikeSchema,
    fit: z.enum(['contain', 'cover', 'fill', 'none', 'scale-down']).optional(),
    variant: z.enum([
      'icon',
      'avatar',
      'smallFeature',
      'mediumFeature',
      'largeFeature',
      'header',
    ]).optional(),
  }),
  description: 'Image with optional fit and variant sizing.',
  component: ({ props }) => {
    const fit = props.fit ?? 'cover';
    const variant = props.variant ?? 'mediumFeature';
    const url = stringifyValue(props.url);

    const mode = (() => {
      switch (fit) {
        case 'contain':
        case 'scale-down':
          return 'aspectFit';
        case 'fill':
          return 'scaleToFill';
        case 'none':
          return 'center';
        default:
          return 'aspectFill';
      }
    })();

    return (
      <image
        auto-size
        src={url}
        mode={mode}
        className={`OpenUIImage OpenUIImageVariant${
          variant.charAt(0).toUpperCase() + variant.slice(1)
        }`}
      />
    );
  },
});
