import { useState } from '@lynx-js/react';

import './App.css';
import { Card } from './Card.jsx';
import { Feed } from './Feed.jsx';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <view className='App'>
      <text className='Title'>{`experimental_backgroundOnlyAssembly`}</text>
      <text className='Description'>
        This screen renders on the main thread. The modules behind {`<Feed/>`}
        {' '}
        and {`<Card/>`}{' '}
        are 'background only': they compile as stub shells for the main thread,
        and their snapshot/worklet definitions are assembled from the background
        compilation for first-screen hydration.
      </text>
      <view className='Card' bindtap={() => setCount(count + 1)}>
        <text className='Card__label'>Tapped {count} times</text>
      </view>
      <Card />
      <Feed />
    </view>
  );
}
