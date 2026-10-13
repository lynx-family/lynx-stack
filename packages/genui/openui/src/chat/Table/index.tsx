// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { Table as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import type { Col } from '../Col/definition.js';
import { childKey, childProps } from '../elements.js';
import '../../../styles/catalog/ChatTable.css';

/** Scrollable Chat table supporting scalar and component cells. */
export const Table: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ({ props, renderNode }) => {
    const columns = (props.columns ?? []).map((node, index) => {
      const col = childProps<z.infer<typeof Col.props>>(node);
      return {
        key: childKey(node, index),
        label: col.label ?? '',
        type: col.type,
        data: Array.isArray(col.data) ? col.data as unknown[] : [],
      };
    });
    const count = Math.max(0, ...columns.map(col => col.data.length));
    return (
      <scroll-view scroll-orientation='horizontal' className='OpenUIChatTable'>
        <view className='OpenUIChatTableRow'>
          {columns.map(col => (
            <view className='OpenUIChatTableCell' key={col.key}>
              <text className='OpenUIChatTableHeader'>{col.label}</text>
            </view>
          ))}
        </view>
        {Array.from(
          { length: count },
          (_, index) => (
            <view className='OpenUIChatTableRow' key={index}>
              {columns.map(col => (
                <view
                  className={`OpenUIChatTableCell ${
                    col.type === 'number' ? 'OpenUIChatTableNumber' : ''
                  }`}
                  key={col.key}
                >
                  {renderNode(col.data[index])}
                </view>
              ))}
            </view>
          ),
        )}
      </scroll-view>
    );
  },
};
