---
"@lynx-js/react": patch
---

New built-in component `<VirtualizedList/>`, which provides a virtualized list view. Unlike the element `<list/>`, `<List/>` renders each item on-demand, which is more efficient for large lists.

```tsx
import { VirtualizedList } from '@lynx-js/react/runtime-components';

return (
  <VirtualizedList
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
    keyExtractor={(item) => `${item.x}`}
    reuseIdentifierExtractor={(item) => ''}
    getItemProps={(item) => ({
      style: 'height: 120rpx;',
    })}
    getItemLayout={(item) => ({
      'full-span': item.x === 10,
    })}
    listProps={{
      style: 'background-color: red; width: 300rpx; height: 500rpx;',
      'preload-buffer-count': 10,
    }}
  />
);
```
