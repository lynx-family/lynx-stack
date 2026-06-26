import { DemoCell } from '../components/index.js';

const gridItems = ['01', '02', '03', '04', '05'];
const placementItems = [
  {
    label: '02',
    className: 'bg-primary-muted',
    textClassName: 'text-primary-content',
  },
  {
    label: '03',
    className: 'bg-neutral-faint',
    textClassName: 'text-content',
  },
  {
    label: '04',
    className: 'bg-primary-muted',
    textClassName: 'text-primary-content',
  },
  {
    label: '05',
    className: 'bg-neutral-faint',
    textClassName: 'text-content',
  },
  {
    label: '06',
    className: 'bg-primary-muted',
    textClassName: 'text-primary-content',
  },
  {
    label: '07',
    className: 'bg-neutral-faint',
    textClassName: 'text-content',
  },
];

function AlignContentGrid({ className }: { className: string }) {
  return (
    <view
      className={`w-full h-[150px] grid grid-cols-3 gap-[8px] bg-neutral-ambient rounded-[12px] p-[8px] ${className}`}
    >
      {gridItems.map((item) => (
        <view
          key={item}
          className='h-[32px] rounded-[8px] bg-primary flex items-center justify-center'
        >
          <text className='text-primary-content text-xs'>{item}</text>
        </view>
      ))}
    </view>
  );
}

function AlignContentStretchGrid() {
  return (
    <view className='w-full h-[150px] grid grid-cols-3 gap-[8px] content-stretch bg-neutral-ambient rounded-[12px] p-[8px]'>
      {gridItems.map((item) => (
        <view
          key={item}
          className='rounded-[8px] bg-primary flex items-center justify-center'
        >
          <text className='text-primary-content text-xs'>{item}</text>
        </view>
      ))}
    </view>
  );
}

function GridPlacementCell(
  { label, className, textClassName }: {
    label: string;
    className: string;
    textClassName: string;
  },
) {
  return (
    <view
      className={`rounded-[8px] flex items-center justify-center ${className}`}
    >
      <text className={`${textClassName} text-xs`}>{label}</text>
    </view>
  );
}

function GridPlacementDemo(
  { className, children }: { className: string; children: JSX.Element },
) {
  return (
    <view
      className={`w-full grid gap-[8px] bg-neutral-ambient rounded-[12px] p-[8px] ${className}`}
    >
      {children}
    </view>
  );
}

export function FlexboxGridDemo() {
  return (
    <view className='w-full flex flex-col gap-[12px]'>
      <DemoCell label='content-start'>
        <AlignContentGrid className='content-start' />
      </DemoCell>

      <DemoCell label='content-center'>
        <AlignContentGrid className='content-center' />
      </DemoCell>

      <DemoCell label='content-end'>
        <AlignContentGrid className='content-end' />
      </DemoCell>

      <DemoCell label='content-between'>
        <AlignContentGrid className='content-between' />
      </DemoCell>

      <DemoCell label='content-around'>
        <AlignContentGrid className='content-around' />
      </DemoCell>

      <DemoCell label='content-stretch'>
        <AlignContentStretchGrid />
      </DemoCell>

      <DemoCell label='justify-start justify-center justify-end justify-around'>
        <view className='w-full flex flex-col gap-[4px]'>
          <view className='w-full flex flex-row justify-start bg-neutral-ambient rounded-[6px]'>
            <view className='size-[16px] rounded-full bg-primary' />
          </view>
          <view className='w-full flex flex-row justify-center bg-neutral-ambient rounded-[6px]'>
            <view className='size-[16px] rounded-full bg-primary' />
          </view>
          <view className='w-full flex flex-row justify-end bg-neutral-ambient rounded-[6px]'>
            <view className='size-[16px] rounded-full bg-primary' />
          </view>
          <view className='w-full flex flex-row justify-around bg-neutral-ambient rounded-[6px]'>
            <view className='size-[16px] rounded-full bg-primary' />
            <view className='size-[16px] rounded-full bg-primary' />
          </view>
        </view>
      </DemoCell>

      <DemoCell label='grid grid-cols-3 col-span-2'>
        <GridPlacementDemo className='h-32 grid-cols-3'>
          <>
            <GridPlacementCell
              label='col-span-2'
              className='bg-primary col-span-2'
              textClassName='text-primary-content'
            />
            {placementItems.slice(0, 4).map((item) => (
              <GridPlacementCell key={item.label} {...item} />
            ))}
          </>
        </GridPlacementDemo>
      </DemoCell>

      <DemoCell label='grid grid-rows-3 row-span-2'>
        <GridPlacementDemo className='h-44 grid-rows-3 grid-cols-3'>
          <>
            <GridPlacementCell
              label='row-span-2'
              className='bg-primary row-span-2'
              textClassName='text-primary-content'
            />
            {placementItems.map((item) => (
              <GridPlacementCell key={item.label} {...item} />
            ))}
          </>
        </GridPlacementDemo>
      </DemoCell>

      <DemoCell label='col-[1/3] row-[1/3]'>
        <GridPlacementDemo className='h-44 grid-cols-3 grid-rows-3'>
          <>
            <GridPlacementCell
              label='col-[1/3] row-[1/3]'
              className='bg-primary col-[1/3] row-[1/3]'
              textClassName='text-primary-content'
            />
            {placementItems.slice(0, 5).map((item) => (
              <GridPlacementCell key={item.label} {...item} />
            ))}
          </>
        </GridPlacementDemo>
      </DemoCell>
    </view>
  );
}
