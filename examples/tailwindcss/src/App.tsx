import { useEffect, useState } from '@lynx-js/react';
import { cn } from './utils.js';
import './App.css';

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const [transform, setTransform] = useState(false);

  return (
    <page>
      <view className='w-full h-full bg-primary'>
        <view
          className='absolute inset-10 top-24 bg-secondary flex flex-col justify-center items-center'
          bindtap={() => setTransform(prev => !prev)}
        >
          <text className='text-primary-content text-6xl'>Hello ReactLynx</text>
          <text
            className={cn(
              'text-primary-content text-xl',
              transform && 'translate-x-10 scale-125',
            )}
          >
            Translate
          </text>
          <text
            className={cn(
              'text-primary-content text-xl translate-x-10',
            )}
          >
            Translate
          </text>
          <text
            className={'text-primary-content text-xl'}
          >
            Translate
          </text>
        </view>
      </view>
    </page>
  );
}
