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
          className='absolute inset-10 top-24 bg-secondary flex flex-col justify-center items-center shadow-lg'
          bindtap={() => setTransform(prev => !prev)}
        >
          <text className='text-primary-content text-6xl underline'>
            Hello ReactLynx
          </text>
          <text
            className={cn(
              'text-primary-content text-xl line-through',
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
            className={'text-primary-content text-xl rotate-x-45 rotate-y-45'}
          >
            Translate
          </text>
        </view>
      </view>
    </page>
  );
}
