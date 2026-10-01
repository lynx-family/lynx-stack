import { useState } from '@lynx-js/react';

import { entryEvalCount, moduleScopedValue } from './module-state.js';
import { reloadTemplate } from './reload-template.js';

const ITEM_COUNT = 500;

const items = Array.from({ length: ITEM_COUNT }, (_, index) => index);

export function App(): JSX.Element {
  const [tick, setTick] = useState(0);

  return (
    <view style='flex-direction: column; padding: 24px;'>
      <text style='font-size: 18px;'>
        entry eval #{entryEvalCount} · module value {moduleScopedValue.current}
        {' '}
        · tick {tick}
      </text>
      <text
        style='font-size: 16px; padding: 12px; background-color: #eee;'
        bindtap={() => {
          moduleScopedValue.current += 1;
          setTick(t => t + 1);
        }}
      >
        mutate module scoped state
      </text>
      <text
        style='font-size: 16px; padding: 12px; background-color: #cde;'
        bindtap={() => {
          reloadTemplate();
        }}
      >
        reloadTemplate
      </text>
      <view style='flex-direction: column;'>
        {items.map(index => (
          <text key={index} style='font-size: 10px;'>
            row {index} · {tick}
          </text>
        ))}
      </view>
    </view>
  );
}
