import type { ReactNode } from 'react';

import {
  createElement,
  useCallback,
  useEffect,
  useState,
} from '@lynx-js/react';

import './App.css';

function DynamicTag(props: {
  tag: string;
  children: ReactNode;
  bindtap?: () => void;
  className?: string;
  style?: Record<string, string | number>;
}) {
  const { tag, children, ...rest } = props;
  return createElement(tag, rest, children);
}

export function App() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const onTap = useCallback(() => {
    'background-only';
    setCount(count + 1);
  }, [count]);

  const onDynamicViewTap = useCallback(() => {
    'background-only';
    setCount(count + 2);
  }, [count]);

  const onDynamicTextTap = useCallback(() => {
    'background-only';
    setCount(count + 3);
  }, [count]);

  return (
    <view>
      <view className='App'>
        <text
          className='Content'
          bindtap={onTap}
          style={{ marginBottom: '50px' }}
        >
          Count: {count}
        </text>
        <DynamicTag tag='view' bindtap={onDynamicViewTap}>
          <text className='Content'>Dynamic view: {count}</text>
          {count > 10 && <text className='Content'>------------------</text>}
        </DynamicTag>
        <DynamicTag
          tag='text'
          className='Content'
          bindtap={onDynamicTextTap}
          style={{ height: '50px' }}
        >
          <text className='Content'>Dynamic text: {count}</text>
        </DynamicTag>
      </view>
    </view>
  );
}
