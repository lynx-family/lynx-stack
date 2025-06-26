import { useEffect, useState } from '@lynx-js/react';
import { cn } from './utils.js';
import './App.css';

export function App() {
  useEffect(() => {
    console.info('Hello, ReactLynx');
  }, []);

  const [reset, setReset] = useState(false);

  return (
    <page>
      <view className='w-full h-full bg-primary'>
        <view
          className='absolute inset-10 top-24 bg-secondary flex flex-col justify-center items-center shadow-lg'
          bindtap={() => setReset(prev => !prev)}
        >
          <text className='text-primary-content text-6xl underline'>
            Hello ReactLynx
          </text>
          <text
            className={cn(
              'text-primary-content text-xl line-through',
              !reset && 'translate-x-10 scale-150',
            )}
          >
            Translate & Scale
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
            Rotate
          </text>
          <text
            className={'text-primary-content text-xl truncate'}
          >
            The longest word in any of the major English language dictionaries
            is pneumonoultramicroscopicsilicovolcanoco
          </text>
        </view>
      </view>
    </page>
  );
}
