// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { Fragment } from '@lynx-js/react';
import type { ReactNode } from '@lynx-js/react';

import { defineComponent } from '../../core/library.jsx';
import {
  GAP_CLASS,
  asArray,
  getAlignClass,
  isTemplateChildren,
  templateChildrenSchema,
} from '../utils.js';

import '../../../styles/catalog/List.css';

const listChildrenSchema = z.union([z.array(z.any()), templateChildrenSchema]);

const listPropsSchema = z.object({
  children: listChildrenSchema.optional(),
  items: listChildrenSchema.optional(),
  direction: z.enum(['vertical', 'horizontal']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch']).optional(),
  gap: z.enum(['none', 'xs', 's', 'm', 'l', 'xl']).optional(),
  divider: z.boolean().optional(),
});

function renderTemplateHint(children: { componentId: string; path: string }) {
  return (
    <view className='OpenUIList'>
      <text className='OpenUIListTemplateHint'>
        {`TemplateChildren(componentId=${children.componentId}, path=${children.path})`}
      </text>
    </view>
  );
}

export const List = defineComponent({
  name: 'List',
  props: listPropsSchema,
  description:
    'List container for repeated children. Supports vertical or horizontal layout.',
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
      GAP_CLASS[gap] ?? GAP_CLASS['m'],
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
});
