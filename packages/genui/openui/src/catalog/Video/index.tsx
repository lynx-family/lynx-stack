// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { Video as VideoDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { stringifyValue } from '../utils.js';

import '../../../styles/catalog/Video.css';

export const Video: DefinedComponent<typeof VideoDefinition.props> = {
  ...VideoDefinition,
  component: ({ props }) => {
    const title = stringifyValue(props.title) || 'Video';
    const url = stringifyValue(props.url);

    return (
      <view className='OpenUIVideo'>
        <view className='OpenUIVideoPoster'>
          <text className='OpenUIVideoPlay'>play_arrow</text>
        </view>
        <view className='OpenUIVideoMeta'>
          <text className='OpenUIVideoTitle'>{title}</text>
          {url ? <text className='OpenUIVideoUrl'>{url}</text> : null}
        </view>
      </view>
    );
  },
};
