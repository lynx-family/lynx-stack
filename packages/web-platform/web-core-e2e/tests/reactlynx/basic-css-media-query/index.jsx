// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root } from '@lynx-js/react';
import './index.css';

// The lynx-examples `css/media_query` demo, with ids added for the assertions:
// https://github.com/lynx-family/lynx-examples/blob/main/examples/css/src/media_query/index.tsx
function MediaQueryDemo() {
  return (
    <view id='demo' className='media-query-demo'>
      <view className='media-query-demo__header'>
        <text className='media-query-demo__eyebrow'>CSS MEDIA QUERY</text>
        <text className='media-query-demo__title'>Portrait breakpoints</text>
        <text className='media-query-demo__description'>
          Use viewport width and height to apply responsive styles without
          rotating the device.
        </text>
      </view>

      <view className='media-query-demo__status'>
        <view className='media-query-demo__status-row'>
          <view id='indicator' className='media-query-demo__indicator' />
          <view id='narrow' className='media-query-demo__narrow'>
            <text>Narrow portrait: under 360px</text>
          </view>
          <view id='regular' className='media-query-demo__regular'>
            <text>Regular portrait: 360px to 399px</text>
          </view>
          <view id='large' className='media-query-demo__large'>
            <text>Large portrait: 400px or wider</text>
          </view>
        </view>
        <view id='tall' className='media-query-demo__tall'>
          <text>Tall viewport: 700px or taller</text>
        </view>
        <view id='density' className='media-query-demo__density'>
          <text>High-density display: 2dppx or higher</text>
        </view>
        <view className='media-query-demo__color-scheme'>
          <text id='light' className='media-query-demo__color-scheme-light'>
            Color scheme: prefers-color-scheme: light
          </text>
          <text id='dark' className='media-query-demo__color-scheme-dark'>
            Color scheme: prefers-color-scheme: dark
          </text>
        </view>
      </view>

      <view className='media-query-demo__panels'>
        <view className='media-query-demo__panel'>
          <text className='media-query-demo__panel-title'>Width range</text>
          <text className='media-query-demo__panel-copy'>
            Use a Level 4 range query to target common portrait widths.
          </text>
        </view>
        <view className='media-query-demo__panel'>
          <text className='media-query-demo__panel-title'>Viewport height</text>
          <text className='media-query-demo__panel-copy'>
            Use min-height to reserve more space on taller screens.
          </text>
        </view>
      </view>
    </view>
  );
}

root.render(<MediaQueryDemo />);
