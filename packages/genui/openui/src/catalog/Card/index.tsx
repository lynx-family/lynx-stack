// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Card as CardDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { GAP_CLASS, asArray } from '../utils.js';

import '../../../styles/catalog/Card.css';

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

export const Card: DefinedComponent<typeof CardDefinition.props> = {
  ...CardDefinition,
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
      GAP_CLASS[gap] ?? GAP_CLASS.m,
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
};
