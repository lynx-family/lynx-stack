// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.js';
import { GAP_CLASS, asArray } from '../utils.js';

function getAlignClass(align: 'start' | 'center' | 'end' | 'stretch'): string {
  switch (align) {
    case 'start':
      return 'OpenUIAlignStart';
    case 'center':
      return 'OpenUIAlignCenter';
    case 'end':
      return 'OpenUIAlignEnd';
    default:
      return 'OpenUIAlignStretch';
  }
}

function getJustifyClass(
  justify: 'start' | 'center' | 'end' | 'between',
): string {
  switch (justify) {
    case 'center':
      return 'OpenUIJustifyCenter';
    case 'end':
      return 'OpenUIJustifyEnd';
    case 'between':
      return 'OpenUIJustifyBetween';
    default:
      return 'OpenUIJustifyStart';
  }
}

export const Card = defineComponent({
  name: 'Card',
  props: z.object({
    children: z.array(z.any()),
    variant: z.enum(['card', 'sunk', 'clear']).optional(),
    direction: z.enum(['row', 'column']).optional(),
    wrap: z.boolean().optional(),
    gap: z.enum(['none', 'xs', 's', 'm', 'l', 'xl']).optional(),
    align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
    justify: z.enum(['start', 'center', 'end', 'between']).optional(),
  }),
  description:
    'Styled container (card/sunk/clear). Accept Stack layout parameters.',
  component: ({ props, renderNode }) => {
    const variant = props.variant ?? 'card';
    let variantClass = 'OpenUICardVariantCard';
    if (variant === 'sunk') {
      variantClass = 'OpenUICardVariantSunk';
    } else if (variant === 'clear') {
      variantClass = 'OpenUICardVariantClear';
    }

    const direction = props.direction ?? 'column';
    const gap = props.gap ?? 'm';
    const align = props.align ?? 'stretch';
    const justify = props.justify ?? 'start';

    const layoutClassName = [
      direction === 'row' ? 'OpenUIStackRow' : 'OpenUIStackColumn',
      props.wrap ? 'OpenUIStackWrap' : '',
      GAP_CLASS[gap] ?? GAP_CLASS['m'],
      getAlignClass(align),
      getJustifyClass(justify),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <view className={`OpenUICard ${variantClass} ${layoutClassName}`}>
        {renderNode(asArray(props.children))}
      </view>
    );
  },
});
