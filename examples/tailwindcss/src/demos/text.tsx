import { DemoCell } from '../components/index.js';

export function TextDemo() {
  return (
    <view className='w-full flex flex-col gap-[12px]'>
      <DemoCell label='text-start text-center text-end text-left text-right'>
        <view className='w-full flex flex-col gap-[4px]'>
          <text className='text-content-subtle text-xs'>
            text-start / text-end requires enableCSSInheritance: true
          </text>
          <text className='w-full text-content text-left'>text-left</text>
          <text className='w-full text-content text-start'>text-start</text>
          <text className='w-full text-content text-center'>text-center</text>
          <text className='w-full text-content text-end'>text-end</text>
          <text className='w-full text-content text-right'>text-right</text>
        </view>
      </DemoCell>

      <DemoCell label='underline line-through overline'>
        <view className='w-full flex flex-row justify-between'>
          <text className='text-content underline'>Underline</text>
          <text className='text-content line-through'>Strike</text>
          <text className='text-content overline'>Overline</text>
        </view>
      </DemoCell>

      <DemoCell label='truncate'>
        <view className='w-full'>
          <text className='text-content text-start'>
            The longest word in any major dictionary
          </text>
          <text className='text-content text-start truncate'>
            is pneumonoultramicroscopicsilicovolcanoconiosis
          </text>
        </view>
      </DemoCell>

      <DemoCell label='whitespace-nowrap break-all'>
        <text className='text-content whitespace-nowrap break-all'>
          pneumonoultramicroscopicsilicovolcanoconiosis
        </text>
      </DemoCell>

      <DemoCell label='whitespace-normal break-normal'>
        <text className='text-content whitespace-normal break-normal'>
          normal whitespace keeps standard wrapping behavior for long content
        </text>
      </DemoCell>

      <DemoCell label='ltr rtl lynx-rtl normal'>
        <view className='w-full flex flex-col gap-[4px]'>
          <text className='w-full text-content ltr'>ltr: Hello 123</text>
          <text className='w-full text-content rtl'>rtl: Hello 123</text>
          <text className='w-full text-content lynx-rtl'>
            lynx-rtl: Hello 123
          </text>
          <text className='w-full text-content normal'>normal: Hello 123</text>
        </view>
      </DemoCell>
    </view>
  );
}
