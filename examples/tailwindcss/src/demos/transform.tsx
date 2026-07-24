import { DemoCell } from '../components/index.js';

export function TransformDemo() {
  return (
    <view className='w-full flex flex-col gap-[12px]'>
      <DemoCell label='translate-x-10 scale-150' className='overflow-visible'>
        <text className='text-content translate-x-10 scale-150'>
          Translate & Scale
        </text>
      </DemoCell>

      <DemoCell label='translate-y-4'>
        <text className='text-content translate-y-4'>
          Translate
        </text>
      </DemoCell>

      <DemoCell label='rotate-x-45 rotate-y-45'>
        <text className='text-content text-xl rotate-x-45 rotate-y-45'>
          Rotate
        </text>
      </DemoCell>

      <DemoCell label='skew-x-12'>
        <view className='w-[120px] h-[40px] rounded-[8px] bg-primary skew-x-12' />
      </DemoCell>

      <DemoCell label='skew-y-12'>
        <view className='w-[120px] h-[40px] rounded-[8px] bg-primary skew-y-12' />
      </DemoCell>

      <DemoCell label='perspective-[400px] rotate-x-45'>
        <view className='perspective-[400px]'>
          <view className='w-[120px] h-[48px] rounded-[8px] bg-primary-muted rotate-x-45' />
        </view>
      </DemoCell>

      <DemoCell label='solo-translate-x-[50px]'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary solo-translate-x-[50px]' />
      </DemoCell>

      <DemoCell label='solo-translate-y-[8px]'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary-muted solo-translate-y-[8px]' />
      </DemoCell>

      <DemoCell label='solo-translate-z-[20px]'>
        <view className='perspective-[400px]'>
          <view className='w-[72px] h-[40px] rounded-[8px] bg-primary solo-translate-z-[20px]' />
        </view>
      </DemoCell>

      <DemoCell label='solo-rotate-12'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary-muted solo-rotate-12' />
      </DemoCell>

      <DemoCell label='solo-rotate-y-45'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary solo-rotate-y-45' />
      </DemoCell>

      <DemoCell label='solo-scale-125'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary-muted solo-scale-125' />
      </DemoCell>

      <DemoCell label='solo-scale-x-150'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary solo-scale-x-150' />
      </DemoCell>

      <DemoCell label='solo-scale-y-75'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary-muted solo-scale-y-75' />
      </DemoCell>

      <DemoCell label='solo-skew-x-12'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary solo-skew-x-12' />
      </DemoCell>

      <DemoCell label='solo-skew-y-12'>
        <view className='w-[72px] h-[40px] rounded-[8px] bg-primary-muted solo-skew-y-12' />
      </DemoCell>
    </view>
  );
}
