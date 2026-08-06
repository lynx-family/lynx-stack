import { DemoCell } from '../components/index.js';

const colorCases = [
  {
    label: 'bg-primary text-primary-content',
    className: 'bg-primary',
    textClassName: 'text-primary-content',
    text: 'Primary',
  },
  {
    label: 'bg-neutral text-neutral-content',
    className: 'bg-neutral',
    textClassName: 'text-neutral-content',
    text: 'Neutral',
  },
  {
    label: 'bg-neutral-faint text-content',
    className: 'bg-neutral-faint',
    textClassName: 'text-content',
    text: 'Neutral faint',
  },
];

export function ColorTokensDemo() {
  return (
    <view className='w-full flex flex-wrap gap-3'>
      {colorCases.map((item) => (
        <DemoCell
          key={item.label}
          label={item.label}
          className={`h-20 w-full items-center justify-center ${item.className}`}
        >
          <text className={item.textClassName}>{item.text}</text>
        </DemoCell>
      ))}
    </view>
  );
}
