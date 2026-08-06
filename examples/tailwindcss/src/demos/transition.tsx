import { useState } from '@lynx-js/react';

import { cn } from '../utils.js';

export function TransitionDemo() {
  const [active, setActive] = useState(false);

  return (
    <view className='w-full flex flex-col gap-[12px]'>
      <view
        className='w-full h-28 rounded-[24px] bg-canvas shadow-lg border border-line flex items-center justify-center'
        bindtap={() => setActive(prev => !prev)}
      >
        <text
          className={cn(
            'text-content text-xl transition-all duration-300 ease-out',
            active && 'translate-x-10 scale-150',
          )}
        >
          transition-all duration-300 ease-out
        </text>
      </view>

      <view
        className='w-full h-28 rounded-[24px] bg-canvas shadow-lg border border-line flex items-center justify-center'
        bindtap={() => setActive(prev => !prev)}
      >
        <text
          className={cn(
            'text-content text-xl transition-transform duration-500 delay-150 ease-in-out',
            active && 'rotate-12 scale-125',
          )}
        >
          transition-transform delay-150
        </text>
      </view>

      <view
        className='w-full h-28 rounded-[24px] bg-canvas shadow-lg border border-line flex items-center justify-center'
        bindtap={() => setActive(prev => !prev)}
      >
        <text
          className={cn(
            'text-content text-xl',
            active ? 'animate-fade-in' : 'animate-fade-out',
          )}
        >
          animate-fade-in / animate-fade-out
        </text>
      </view>

      <view
        className='w-full h-28 rounded-[24px] bg-canvas shadow-lg border border-line flex items-center justify-center'
        bindtap={() => setActive(prev => !prev)}
      >
        <text
          className={cn(
            'text-content text-xl transition-opacity duration-700 ease-linear',
            active ? 'opacity-40' : 'opacity-100',
          )}
        >
          transition-opacity duration-700 ease-linear
        </text>
      </view>

      <view
        className='w-full h-28 rounded-[24px] bg-canvas shadow-lg border border-line flex items-center justify-center'
        bindtap={() => setActive(prev => !prev)}
      >
        <text
          className={cn(
            'text-content text-xl transition-none',
            active && 'translate-x-10',
          )}
        >
          transition-none
        </text>
      </view>
    </view>
  );
}
