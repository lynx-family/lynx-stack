import { useState } from '@lynx-js/react';

import './App.css';
import Counter from './comp-lib/index.js';

console.info('[side-effect] App module evaluated');

export function App() {
  const [tick, setTick] = useState(0);

  return (
    <view className='page'>
      <view className='card'>
        <text className='title'>Rendered by the background thread</text>
        <text className='subtitle'>
          enableMTSRendering: false — empty first frame, hydrated by BTS
        </text>
        <view className='button' bindtap={() => setTick(tick + 1)}>
          <text className='button-text'>{`tick: ${tick}`}</text>
        </view>
        {__MAIN_THREAD__ ? null : <Counter />}
      </view>
    </view>
  );
}
