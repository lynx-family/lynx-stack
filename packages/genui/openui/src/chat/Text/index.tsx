// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { z } from 'zod/v4';

import { Text as definition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import '../../../styles/catalog/ChatText.css';

export function ChatText(
  { props, bold = false }: {
    props: z.infer<typeof definition.props>;
    bold?: boolean;
  },
) {
  let tone = '';
  if (props.subtextVariant === 'metric') {
    if (props.subtext?.startsWith('+')) tone = 'OpenUIChatPositive';
    if (props.subtext?.startsWith('-')) tone = 'OpenUIChatNegative';
  }
  return (
    <view className='OpenUIChatTextBlock'>
      <text
        className={`OpenUIChatText OpenUIChatText-${props.size ?? 'sm'} ${
          bold ? 'OpenUIChatBold' : ''
        } ${props.variant === 'number' ? 'OpenUIChatNumber' : ''}`}
      >
        {props.value ?? ''}
      </text>
      {props.subtext != null && (
        <text
          className={`OpenUIChatSubtext ${tone} ${
            props.subtextVariant === 'number' ? 'OpenUIChatNumber' : ''
          }`}
        >
          {props.subtext}
        </text>
      )}
    </view>
  );
}

/** ReactLynx renderer for the OpenUI Chat Text contract. */
export const Text: DefinedComponent<typeof definition.props> = {
  ...definition,
  component: ChatText,
};
