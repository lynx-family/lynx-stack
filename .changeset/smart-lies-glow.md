---
"@lynx-dev/react": patch
---

New built-in component `<List/>`, which provide a virtualized list view.

```jsx
import { List } from '@lynx-dev/react';

<List
  data={Array.from({ length: 1000 }).map((_, index) => ({ x: index }))}
  renderItem={(item) => {
    return (
      <view style='background-color: green; width: 100%; height: 120rpx; margin-bottom: 10rpx;'>
        <text>
          {`Item ${item.x}`}
        </text>
      </view>
    );
  }}
  getItemProps={(item) => ({
    'estimated-height-px': 120,
  })}
  keyExtractor={(item) => `${item.x}`}
  listProps={{
    style: 'background-color: red; width: 300rpx; height: 500rpx;',
    'preload-buffer-count': 10,
  }}
/>;
```
