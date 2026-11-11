// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { useState } from '@lynx-js/react';

import '../../../styles/catalog/ChatImage.css';

/** Shared image lifecycle; callers key by source to reset loading on replacement. */
export function ChatImage(
  { src, alt, block = false }: { src: string; alt: string; block?: boolean },
) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [ratio, setRatio] = useState(1.5);
  return (
    <view
      className={`OpenUIChatImage ${
        block ? 'OpenUIChatImageBlock' : ''
      } OpenUIChatImage-${status}`}
      style={{ aspectRatio: ratio }}
    >
      {src && (
        <image
          className='OpenUIChatImageContent'
          src={src}
          accessibility-label={alt}
          mode={block ? 'aspectFit' : 'aspectFill'}
          bindload={event => {
            const { width, height } = event.detail;
            if (block && width > 0 && height > 0) setRatio(width / height);
            setStatus('loaded');
          }}
          binderror={() => setStatus('error')}
        />
      )}
      {src && status === 'loading' && (
        <view className='OpenUIChatImageLoading' />
      )}
      {(!src || status === 'error') && alt && (
        <text className='OpenUIChatImageAlt'>{alt}</text>
      )}
    </view>
  );
}
