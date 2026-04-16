import * as v0_9 from '@a2ui/web_core/v0_9';
import type { ComponentProps } from "../../core/ComponentRegistry";

import './style.css';

export interface CheckBoxProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function CheckBox(props: any): any {
  const { id, label = 'CheckBox', value, setValue } = props;

  const handleChange = () => {
    setValue?.('value', !value);
  };

  return (
    <view key={id} className="checkbox-row" bindtap={handleChange}>
      <view className="checkbox-input">
        {value && <text>✓</text>}
      </view>
      <text className="checkbox-label">{label as string}</text>
    </view>
  );
}
