// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useRef } from '@lynx-js/react';
import './index.css';

const src = JSON.stringify({
  id: '6881187861773765389',
  artist: 'bro',
  album_title: '',
  artwork_url: '',
  play_url: '/resources/ddee519472dd7e73eeb153e78d484db3.mp3',
  // local_url:'',
  title: 'DJ',
  duration: 32,
  can_background_play: '1',
});

function App() {
  const audioRef = useRef();
  const handleTap = () => {
    const methodStr = e['target']['id'];
    if (methodStr == 'seek') {
      lynx.createSelectorQuery().select('x-audio-tt').invoke({
        method: methodStr,
        params: {
          'currentTime': 5000,
        },
      });
    } else {
      lynx.createSelectorQuery().select('x-audio-tt').invoke({
        method: methodStr,
      });
    }
  };

  return (
    <view>
      <x-audio-tt src={src} ref={audioRef}></x-audio-tt>

      <text id='play' class='text' bindtap={handleTap}>播放</text>
      <text id='pause' class='text' bindtap={handleTap}>暂停</text>
      <text id='resume' class='text' bindtap={handleTap}>恢复</text>
      <text id='stop' class='text' bindtap={handleTap}>停止</text>
    </view>
  );
}

root.render(<App></App>);
