// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { memo } from '@lynx-js/react';

import './Markdown.css';

// Updating a neighbouring UI block must not reparse unchanged Markdown.
export const Markdown = memo(
  function Markdown({ content }: { content: string }) {
    return (
      <view className='OpenUIMarkdown'>
        {
          /* A delta can complete earlier Markdown syntax. Reparse this text
            element while keeping neighbouring interactive UI blocks mounted. */
        }
        {/* @ts-expect-error x-markdown is provided by the host. */}
        <x-markdown key={content} content={content} />
      </view>
    );
  },
);
