import type { ReactNode } from '@lynx-js/react';

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <view className='w-full px-[16px] py-[24px] bg-paper rounded-[16px] my-[16px] overflow-hidden'>
      <text className='text-xl text-content font-bold'>
        {title}
      </text>
      {description && (
        <text className='text-sm text-content-2 mt-1'>
          {description}
        </text>
      )}
      <view className='w-full mt-[24px] flex flex-col gap-[12px] px-[8px]'>
        {children}
      </view>
    </view>
  );
}
