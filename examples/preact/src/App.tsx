import { useCallback, useState } from 'preact/hooks';
import './App.css';

export function App() {
  const [count, setCount] = useState(0);

  const onTap = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <view className='App'>
      <view className='Banner'>
        <text className='Title'>Preact</text>
        <text className='Subtitle'>on Lynx</text>
      </view>
      <view className='Content'>
        <text className='Description'>Count: {count}</text>
        <view className='Button' onClick={onTap}>
          <text className='ButtonText'>Tap me!</text>
        </view>
        <text className='Hint'>
          Edit<text
            style={{ fontStyle: 'italic', color: 'rgba(255, 255, 255, 0.85)' }}
          >
            {' src/App.tsx '}
          </text>
          to see updates!
        </text>
      </view>
      <view style={{ flex: 1 }} />
    </view>
  );
}
