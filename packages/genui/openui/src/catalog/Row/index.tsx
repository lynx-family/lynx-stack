// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';
import {
  GAP_CLASS,
  asArray,
  getAlignClass,
  getJustifyClass,
} from '../utils.js';

const rowPropsSchema = z.object({
  children: z.array(z.any()),
  justify: z.enum([
    'start',
    'center',
    'end',
    'between',
    'around',
    'evenly',
    'spaceBetween',
    'spaceAround',
    'spaceEvenly',
    'stretch',
  ]).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  gap: z.enum(['none', 'xs', 's', 'm', 'l', 'xl']).optional(),
  wrap: z.boolean().optional(),
});

export const Row = defineComponent({
  name: 'Row',
  props: rowPropsSchema,
  description: 'Horizontal flex layout container.',
  component: ({ props, renderNode }) => {
    const gap = props.gap ?? 'm';
    const className = [
      'OpenUIRow',
      'OpenUIStack',
      'OpenUIStackRow',
      props.wrap ? 'OpenUIStackWrap' : '',
      GAP_CLASS[gap] ?? GAP_CLASS['m'],
      getAlignClass(props.align ?? 'center'),
      getJustifyClass(props.justify ?? 'start'),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <view className={className}>{renderNode(asArray(props.children))}</view>
    );
  },
});
