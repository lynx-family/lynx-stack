import { DemoCell } from '../components/index.js';

export function LayoutDemo() {
  return (
    <view className='w-full flex flex-col gap-[12px]'>
      <DemoCell label='flex grid hidden linear display-relative'>
        <view className='w-full flex flex-col gap-[6px]'>
          <view className='flex flex-row justify-center gap-[8px]'>
            <text className='text-content text-xs'>flex</text>
            <text className='text-content text-xs grid'>grid</text>
            <text className='text-content text-xs linear'>linear</text>
            <text className='text-content text-xs display-relative'>
              display-relative
            </text>
          </view>
          <view className='flex flex-row justify-center gap-[8px]'>
            <view className='size-[20px] rounded-full bg-primary' />
            <view className='size-[20px] rounded-full bg-primary hidden' />
            <view className='size-[20px] rounded-full bg-primary' />
          </view>
          <text className='text-content-subtle text-xs'>
            The middle dot uses hidden.
          </text>
        </view>
      </DemoCell>

      <DemoCell label='flex flex-row justify-between items-center'>
        <view className='w-full flex flex-row justify-between items-center'>
          <view className='size-[24px] rounded-full bg-primary' />
          <view className='size-[24px] rounded-full bg-neutral' />
          <view className='size-[24px] rounded-full bg-neutral-faint' />
        </view>
      </DemoCell>

      <DemoCell label='relative absolute inset-2'>
        <view className='relative w-full h-24 rounded-[12px] bg-neutral-ambient'>
          <view className='absolute inset-2 rounded-[8px] bg-primary' />
        </view>
      </DemoCell>

      <DemoCell label='top-2 right-2 bottom-2 left-2 inset-x-4 inset-y-6 start-4 end-4'>
        <view className='relative w-full h-32 rounded-[12px] bg-neutral-ambient'>
          <view className='absolute top-2 right-2 bottom-2 left-2 rounded-[8px] bg-paper-clear border border-line' />
          <view className='absolute inset-x-4 inset-y-6 rounded-[8px] bg-primary' />
          <view className='absolute start-4 end-4 top-[42px] h-[8px] rounded-full bg-neutral' />
        </view>
      </DemoCell>

      <DemoCell label='overflow-hidden overflow-visible'>
        <view className='w-full flex flex-row justify-between overflow-visible'>
          <view className='w-[45%] h-[72px] rounded-[12px] bg-neutral-ambient overflow-hidden'>
            <view className='w-[140%] h-[40px] rounded-[24px] bg-primary translate-x-10' />
          </view>
          <view className='w-[45%] h-[72px] rounded-[12px] bg-neutral-ambient overflow-visible'>
            <view className='w-[140%] h-[40px] rounded-[24px] bg-primary translate-x-10' />
          </view>
        </view>
      </DemoCell>

      <DemoCell label='visible invisible'>
        <view className='w-full flex flex-row justify-center gap-[12px]'>
          <view className='flex flex-col items-center gap-[4px]'>
            <view className='size-[32px] rounded-full bg-primary visible' />
            <text className='text-content-muted text-xs'>visible</text>
          </view>
          <view className='flex flex-col items-center gap-[4px]'>
            <view className='size-[32px] rounded-full bg-primary invisible' />
            <text className='text-content-muted text-xs'>invisible</text>
          </view>
          <view className='flex flex-col items-center gap-[4px]'>
            <view className='size-[32px] rounded-full bg-primary visible' />
            <text className='text-content-muted text-xs'>visible</text>
          </view>
        </view>
      </DemoCell>
    </view>
  );
}
