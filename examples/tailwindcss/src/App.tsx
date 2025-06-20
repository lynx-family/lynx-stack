import { useEffect } from '@lynx-js/react';
import { cn } from './lib/utils.js';
import './App.css';

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  return (
    <page>
      <view className='w-full h-full bg-primary flex flex-col justify-center items-center'>
        <text className='text-primary-content text-6xl'>Hello ReactLynx</text>
        <text
          className={cn(
            'text-primary-content text-6xl absolute',
          )}
        >
        </text>
      </view>
    </page>
  );
}
