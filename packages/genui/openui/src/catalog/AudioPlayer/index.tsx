// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { AudioPlayer as AudioPlayerDefinition } from './definition.js';
import type { DefinedComponent } from '../../core/library.jsx';
import { stringifyValue } from '../utils.js';

import '../../../styles/catalog/AudioPlayer.css';

export const AudioPlayer: DefinedComponent<typeof AudioPlayerDefinition.props> =
  {
    ...AudioPlayerDefinition,
    component: ({ props }) => {
      const description = stringifyValue(props.description);
      const url = stringifyValue(props.url);

      return (
        <view className='OpenUIAudio'>
          <view className='OpenUIAudioIcon'>
            <text className='OpenUIAudioIconText'>music_note</text>
          </view>
          <view className='OpenUIAudioContent'>
            <text className='OpenUIAudioTitle'>{description || 'Audio'}</text>
            {url ? <text className='OpenUIAudioUrl'>{url}</text> : null}
          </view>
        </view>
      );
    },
  };
