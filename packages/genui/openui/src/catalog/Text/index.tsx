// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';
import { stringLikeSchema, stringifyValue } from '../utils.js';

import '../../../styles/catalog/Text.css';

const textVariants = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'caption',
  'body',
] as const;

function getVariantClass(variant: typeof textVariants[number]): string {
  switch (variant) {
    case 'h1':
      return 'OpenUITextH1';
    case 'h2':
      return 'OpenUITextH2';
    case 'h3':
      return 'OpenUITextH3';
    case 'h4':
      return 'OpenUITextH4';
    case 'h5':
      return 'OpenUITextH5';
    case 'caption':
      return 'OpenUITextCaption';
    default:
      return 'OpenUITextBody';
  }
}

export const Text = defineComponent({
  name: 'Text',
  props: z.object({
    text: stringLikeSchema,
    variant: z.enum(textVariants).optional(),
  }),
  description: 'Plain text with display variants.',
  component: ({ props }) => {
    const variant = props.variant ?? 'body';
    return (
      <text className={`OpenUIText ${getVariantClass(variant)}`}>
        {stringifyValue(props.text)}
      </text>
    );
  },
});
