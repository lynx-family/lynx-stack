import { DemoCell } from '../components/index.js';

export function EffectsDemo() {
  return (
    <view className='w-full flex flex-col gap-[12px]'>
      <DemoCell label='shadow shadow-lg shadow-none'>
        <view className='w-full flex flex-row justify-between items-center'>
          <view className='size-[48px] rounded-[12px] bg-canvas shadow' />
          <view className='size-[48px] rounded-[12px] bg-canvas shadow-lg' />
          <view className='size-[48px] rounded-[12px] bg-canvas shadow-none' />
        </view>
      </DemoCell>

      <DemoCell label='blur-sm'>
        <text className='text-content text-xl blur-sm'>Blurred text</text>
      </DemoCell>

      <DemoCell label='filter-none blur-sm grayscale grayscale-0'>
        <view className='w-full flex flex-row justify-center gap-[12px]'>
          <view className='size-[40px] rounded-full bg-primary filter-none' />
          <view className='size-[40px] rounded-full bg-primary grayscale' />
          <view className='size-[40px] rounded-full bg-primary grayscale-0' />
        </view>
      </DemoCell>

      <DemoCell label='bg-clip-border bg-clip-padding bg-clip-content'>
        <view className='w-full flex flex-row justify-center gap-[12px]'>
          <view className='w-[64px] h-[56px] rounded-[16px] border-[8px] border-line bg-primary bg-clip-border' />
          <view className='w-[64px] h-[56px] rounded-[16px] border-[8px] border-line bg-primary bg-clip-padding' />
          <view className='w-[64px] h-[56px] rounded-[16px] border-[8px] border-line bg-primary bg-clip-content' />
        </view>
      </DemoCell>
    </view>
  );
}
