import { useState } from '@lynx-js/react';

import { cn } from '../utils.js';

interface SwitchProps {
  size?: 'sm' | 'lg';
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function Switch(
  {
    size = 'sm',
    defaultChecked = false,
    checked: checkedProp,
    onCheckedChange,
    disabled = false,
    className,
  }: SwitchProps,
) {
  const isControlled = checkedProp !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(
    defaultChecked,
  );

  const checked = isControlled ? checkedProp : uncontrolledChecked;

  const handleToggle = () => {
    if (disabled) return;
    const next = !checked;
    if (!isControlled) {
      setUncontrolledChecked(next);
    }
    onCheckedChange?.(next);
  };

  return (
    <view
      className={cn(
        'lynx-rounded-full lynx-overflow-hidden lynx-flex lynx-flex-row lynx-items-center ui-disabled:lynx-opacity-50 active:lynx-opacity-80',
        size === 'sm' && 'lynx-w-[38px] lynx-h-[22px]',
        size === 'lg' && 'lynx-w-[48px] lynx-h-[28px]',
        disabled && 'ui-disabled',
        'lynx-peer',
        className,
      )}
      bindtap={handleToggle}
    >
      {/* Track */}
      <view
        className={cn(
          'lynx-size-full lynx-transition-all lynx-bg-neutral-faint ui-checked:lynx-bg-primary',
          checked && 'ui-checked',
        )}
      />
      {/* Thumb */}
      <view
        className={cn(
          'lynx-absolute lynx-rounded-full lynx-size-full lynx-bg-primary-content lynx-transform-[translateX(3px)] lynx-transition-all lynx-shadow',
          checked && 'ui-checked',
          size === 'sm'
            && 'lynx-size-[16px] active:lynx-w-[24px] ui-checked:lynx-transform-[translateX(19px)] ui-checked:active:lynx-transform-[translateX(11px)]',
          size === 'lg'
            && 'lynx-size-[22px] active:lynx-w-[33px] ui-checked:lynx-transform-[translateX(23px)] ui-checked:active:lynx-transform-[translateX(12px)]',
        )}
      />
      <view />
    </view>
  );
}

export { Switch };
