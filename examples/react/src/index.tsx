import { root } from '@lynx-js/react';

root.render(
  <list
    custom-list-name='list-container'
    style='height: 700rpx; width: 700rpx; background-color: #f0f0f0;'
  >
    <list-item item-key='x' deferred>
      <view style='height: 50rpx; width: 600rpx; background-color: red;' />
    </list-item>

    {Array.from({ length: 100 }).map((_, index) => (
      <list-item item-key={`${index}`} key={index} deferred>
        <view style='height: 50rpx; width: 600rpx; background-color: #fff; border-bottom: 1px solid #ccc;'>
          <text style='padding: 10rpx;'>Item {index + 1}</text>
        </view>
      </list-item>
    ))}
  </list>,
);

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept();
}
