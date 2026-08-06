import { DemoCell } from '../components/index.js';

function BackgroundClipBox({ label, className }: {
  label: string;
  className: string;
}) {
  return (
    <view className='flex flex-col items-center gap-[4px]'>
      <view
        className={`w-[72px] h-[64px] rounded-[16px] border-[8px] border-line p-[10px] bg-primary ${className}`}
      >
        <view className='w-full h-full rounded-[8px] bg-paper-veil' />
      </view>
      <text className='text-content-muted text-xs'>{label}</text>
    </view>
  );
}

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
          <BackgroundClipBox
            label='border'
            className='bg-clip-border'
          />
          <BackgroundClipBox
            label='padding'
            className='bg-clip-padding'
          />
          <BackgroundClipBox
            label='content'
            className='bg-clip-content'
          />
        </view>
      </DemoCell>
    </view>
  );
}
