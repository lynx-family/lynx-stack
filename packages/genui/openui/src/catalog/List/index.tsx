// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Fragment } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { List as ListDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import {
  GAP_CLASS,
  asArray,
  getAlignClass,
  isTemplateChildren,
} from '../utils.js';

import '../../../styles/catalog/List.css';

function renderTemplateHint(children: { componentId: string; path: string }) {
  return (
    <view className='OpenUIList'>
      <text className='OpenUIListTemplateHint'>
        {`TemplateChildren(componentId=${children.componentId}, path=${children.path})`}
      </text>
    </view>
  );
}

export const List: DefinedComponent<typeof ListDefinition.props> = {
  ...ListDefinition,
  component: ({ props, renderNode }) => {
    const children = props.children ?? props.items ?? [];

    if (isTemplateChildren(children)) {
      return renderTemplateHint(children);
    }

    const direction = props.direction ?? 'vertical';
    const gap = props.gap ?? 'm';
    const items = asArray(children);
    const dividerClassName = direction === 'horizontal'
      ? 'OpenUIListDivider OpenUIListDividerVertical'
      : 'OpenUIListDivider OpenUIListDividerHorizontal';
    const className = [
      'OpenUIList',
      direction === 'horizontal' ? 'OpenUIStackRow' : 'OpenUIStackColumn',
      GAP_CLASS[gap] ?? GAP_CLASS.m,
      getAlignClass(props.align ?? 'stretch'),
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <view className={className}>
        {items.map((item: unknown, index: number): ReactNode => (
          <Fragment key={index}>
            {props.divider && index > 0
              ? <view className={dividerClassName} />
              : null}
            {renderNode(item)}
          </Fragment>
        ))}
      </view>
    );
  },
};
