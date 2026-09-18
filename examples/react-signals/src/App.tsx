import { useRef } from '@lynx-js/react';
import { useSignal } from '@lynx-js/react-signals';
import type { Signal } from '@lynx-js/react-signals';

import './App.css';

function CounterValue({ count }: { count: Signal<number> }) {
  const renderCount = useRef(0);
  renderCount.current += 1;

  return (
    <view className='CounterValueBlock'>
      <text className='CounterValueLabel'>CounterValue component</text>
      <text className='CounterValue'>{count.value}</text>
      <text className='CounterRenderCount'>
        Render count: {renderCount.current}
      </text>
    </view>
  );
}

export function App() {
  const count = useSignal(0);

  const increment = () => {
    'background-only';
    const previousValue = count.value;
    count.value = previousValue + 1;
  };

  return (
    <view className='App'>
      <text className='Title'>ReactLynx Signals</text>
      <CounterValue count={count} />
      <view className='Button' bindtap={increment}>
        <text className='ButtonText'>Increment</text>
      </view>
    </view>
  );
}
