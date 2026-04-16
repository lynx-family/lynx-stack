import { A2UIRender } from "../../core/A2UIRender";

import './style.css';

export function Button(props: any): any {
  const { action, child, surface, sendAction } = props;

  const handleClick = async () => {
    if (action) {
      await sendAction?.(action);
    }
  };

  const childResource = child ? surface.resources.get(child) : undefined;

  return (
    <view className="button" bindtap={handleClick}>
      {childResource ? <A2UIRender resource={childResource} /> : <text>Button</text>}
    </view>
  );
}
