import { Radio, RadioGroupRoot, RadioIndicator } from "@lynx-js/lynx-ui";
import type { ComponentProps } from "../../core/ComponentRegistry";

import "./style.css";

const HitSlop = {
  "hit-slop": {
    top: "8px" as `${number}px`,
    left: "8px" as `${number}px`,
    right: "8px" as `${number}px`,
    bottom: "8px" as `${number}px`,
  },
};

import type { ComponentInstance } from "../../core/types";

export interface RadioGroupProps extends ComponentProps {
  component: ComponentInstance & { dataContextPath?: string };
}

export function RadioGroup(props: any): any {
  const { value, items, usageHint = "default", setValue } = props;
  const explicitItems = Array.isArray(items) ? items : [];

  const handleValueChange = (newValue: string) => {
    setValue?.('value', newValue);
  };

  return (
    <view className={`radio-group radio-group-${usageHint}`}>
      <RadioGroupRoot value={value as string} onValueChange={handleValueChange}>
        <view className="radio-group-container">
          {explicitItems.map((itemValue: string) => (
            <view key={itemValue} className="radio-option">
              <Radio
                className="radio-item"
                value={itemValue}
                radioProps={HitSlop}
              >
                <RadioIndicator className="radio-indicator">
                  <view className="radio-indicator-dot" />
                </RadioIndicator>
              </Radio>
              <text className="label">{itemValue}</text>
            </view>
          ))}
        </view>
      </RadioGroupRoot>
    </view>
  );
}
