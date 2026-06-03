// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { z } from 'zod/v4';

import { defineComponent } from '../../core/library.jsx';

export const TextContent = defineComponent({
  name: 'TextContent',
  props: z.object({
    text: z.union([z.string(), z.number(), z.boolean()]),
    size: z.enum(['small', 'default', 'large', 'small-heavy', 'large-heavy'])
      .optional(),
  }),
  description: 'Text content with optional size.',
  component: ({ props }) => {
    const size = props.size ?? 'default';
    let sizeClass = 'OpenUITextContentDefault';
    if (size === 'small') {
      sizeClass = 'OpenUITextContentSmall';
    } else if (size === 'large') {
      sizeClass = 'OpenUITextContentLarge';
    } else if (size === 'small-heavy') {
      sizeClass = 'OpenUITextContentSmallHeavy';
    } else if (size === 'large-heavy') {
      sizeClass = 'OpenUITextContentLargeHeavy';
    }

    return (
      <text className={`OpenUITextContent ${sizeClass}`}>
        {String(props.text ?? '')}
      </text>
    );
  },
});
