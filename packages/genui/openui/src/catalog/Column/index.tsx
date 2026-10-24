// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Column as ColumnDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import {
  GAP_CLASS,
  asArray,
  getAlignClass,
  getJustifyClass,
} from '../utils.js';

import '../../../styles/catalog/Column.css';

export const Column: DefinedComponent<typeof ColumnDefinition.props> = {
  ...ColumnDefinition,
  component: ({ props, renderNode }) => {
    const gap = props.gap ?? 'm';
    const className = [
      'OpenUIColumn',
      'OpenUIStack',
      'OpenUIStackColumn',
      GAP_CLASS[gap] ?? GAP_CLASS.m,
      getAlignClass(props.align ?? 'stretch'),
      getJustifyClass(props.justify ?? 'start'),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <view className={className}>{renderNode(asArray(props.children))}</view>
    );
  },
};
