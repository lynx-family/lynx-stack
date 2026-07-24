import { useState } from '@lynx-js/react';

// A background-only side effect (the main thread cannot call `getJSModule`).
// It stays out of the main-thread bundle because the module is reduced to its
// snapshot registration there, and only runs on the background thread.
lynx.getJSModule('GlobalEventEmitter').addListener('myHappyEvent', () => {
  console.info('myHappyEvent triggered!');
});

export default function Counter() {
  const [count, setCount] = useState(0);

  const onTap = () => {
    setCount(count + 1);
    // Runs on the background thread, where `GlobalEventEmitter` exists, so the
    // listener registered above fires: tap the button and watch the console.
    lynx.getJSModule('GlobalEventEmitter').emit('myHappyEvent', {});
  };

  return (
    <view className='button button-secondary' bindtap={onTap}>
      <text className='button-text'>{`count: ${count}`}</text>
    </view>
  );
}
