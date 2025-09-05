// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { root, useState, useRef, useEffect } from '@lynx-js/react';

function App() {
  const [rpxLength, setRpxLength] = useState('1px');
  const [containerWidth, setContainerWidth] = useState(750);
  const lynxViewRef = useRef(null);

  // Update rpx-length attribute on lynx-view
  const updateRpxLength = (newLength) => {
    setRpxLength(newLength);
    if (lynxViewRef.current) {
      lynxViewRef.current.setAttribute('rpx-length', newLength);
    }
  };

  // Calculate rpx-length based on container width (750rpx = container width)
  const updateByContainerWidth = (width) => {
    setContainerWidth(width);
    const newRpxLength = `${width / 750}px`;
    updateRpxLength(newRpxLength);
  };

  return (
    <page>
      {/* Control Panel */}
      <view
        id='control-panel'
        style='padding: 20rpx; background: #f5f5f5; margin-bottom: 20rpx;'
      >
        <view
          id='current-rpx-info'
          style='margin-bottom: 10rpx; font-size: 14px; font-weight: bold;'
        >
          Current rpx-length: {rpxLength}
        </view>

        <view
          id='container-width-info'
          style='margin-bottom: 15rpx; font-size: 14px;'
        >
          Container Width: {containerWidth}px (750rpx = {containerWidth}px)
        </view>

        {/* Preset rpx-length buttons */}
        <view style='margin-bottom: 15rpx;'>
          <button
            id='set-rpx-0-5px'
            bindtap={() => updateRpxLength('0.5px')}
            style='margin-right: 10rpx; padding: 5rpx 10rpx; background: #e3f2fd;'
          >
            0.5px (Mobile)
          </button>

          <button
            id='set-rpx-1px'
            bindtap={() => updateRpxLength('1px')}
            style='margin-right: 10rpx; padding: 5rpx 10rpx; background: #e8f5e8;'
          >
            1px (Standard)
          </button>

          <button
            id='set-rpx-2px'
            bindtap={() => updateRpxLength('2px')}
            style='margin-right: 10rpx; padding: 5rpx 10rpx; background: #fff3e0;'
          >
            2px (Large)
          </button>
        </view>

        {/* Container width buttons */}
        <view style='margin-bottom: 15rpx;'>
          <button
            id='set-width-375'
            bindtap={() => updateByContainerWidth(375)}
            style='margin-right: 10rpx; padding: 5rpx 10rpx; background: #fce4ec;'
          >
            375px (iPhone)
          </button>

          <button
            id='set-width-750'
            bindtap={() => updateByContainerWidth(750)}
            style='margin-right: 10rpx; padding: 5rpx 10rpx; background: #f3e5f5;'
          >
            750px (Design)
          </button>

          <button
            id='set-width-1125'
            bindtap={() => updateByContainerWidth(1125)}
            style='padding: 5rpx 10rpx; background: #e0f2f1;'
          >
            1125px (iPad)
          </button>
        </view>
      </view>

      {/* Test Elements Container with rpx-length attribute */}
      <lynx-view
        ref={lynxViewRef}
        rpx-length={rpxLength}
        style='border: 2px solid #333; padding: 10rpx;'
      >
        {/* Basic rpx elements */}
        <view
          id='test-element-100rpx'
          style='width: 100rpx; height: 50rpx; background: #ff6b6b; margin: 10rpx; display: inline-block;'
        >
          <text style='color: white; font-size: 12px;'>100rpx</text>
        </view>

        <view
          id='test-element-200rpx'
          style='width: 200rpx; height: 50rpx; background: #4ecdc4; margin: 10rpx; display: inline-block;'
        >
          <text style='color: white; font-size: 12px;'>200rpx</text>
        </view>

        <view
          id='test-element-300rpx'
          style='width: 300rpx; height: 50rpx; background: #45b7d1; margin: 10rpx; display: inline-block;'
        >
          <text style='color: white; font-size: 12px;'>300rpx</text>
        </view>

        {/* Complex rpx properties */}
        <view
          id='complex-rpx-element'
          style='
            width: 250rpx; 
            height: 80rpx; 
            margin: 15rpx 20rpx; 
            padding: 10rpx 15rpx;
            border: 2rpx solid #666;
            border-radius: 8rpx;
            background: linear-gradient(45deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 14px;
          '
        >
          <text>Complex Element</text>
          <text style='display: block; font-size: 10px; margin-top: 5rpx;'>
            Width: 250rpx, Padding: 10rpx 15rpx, Border: 2rpx
          </text>
        </view>

        {/* Responsive layout with rpx */}
        <view id='responsive-container' style='width: 100%; margin-top: 20rpx;'>
          <view
            id='responsive-item-1'
            style='width: 33.33%; height: 60rpx; background: #96ceb4; display: inline-block; padding: 5rpx; box-sizing: border-box;'
          >
            <text style='font-size: 10px;'>Item 1 (33.33%)</text>
            <text style='display: block; font-size: 8px; margin-top: 2rpx;'>
              Height: 60rpx, Padding: 5rpx
            </text>
          </view>

          <view
            id='responsive-item-2'
            style='width: 33.33%; height: 60rpx; background: #ffeaa7; display: inline-block; padding: 5rpx; box-sizing: border-box;'
          >
            <text style='font-size: 10px;'>Item 2 (33.33%)</text>
            <text style='display: block; font-size: 8px; margin-top: 2rpx;'>
              Height: 60rpx, Padding: 5rpx
            </text>
          </view>

          <view
            id='responsive-item-3'
            style='width: 33.33%; height: 60rpx; background: #dda0dd; display: inline-block; padding: 5rpx; box-sizing: border-box;'
          >
            <text style='font-size: 10px;'>Item 3 (33.33%)</text>
            <text style='display: block; font-size: 8px; margin-top: 2rpx;'>
              Height: 60rpx, Padding: 5rpx
            </text>
          </view>
        </view>

        {/* Mixed units test */}
        <view
          id='mixed-units-element'
          style='
            width: 400rpx;
            height: 60px;
            margin: 10rpx 20px;
            padding: 8rpx 12px;
            background: #fd79a8;
            color: white;
            font-size: 12px;
          '
        >
          <text>Mixed Units: 400rpx width, 60px height</text>
          <text style='display: block; font-size: 10px; margin-top: 2rpx;'>
            Margin: 10rpx 20px, Padding: 8rpx 12px
          </text>
        </view>

        {/* Animation test element */}
        <view
          id='animation-test-element'
          style='
            width: 150rpx;
            height: 150rpx;
            background: #fd63a3;
            margin: 20rpx auto;
            border-radius: 50%;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
          '
        >
          <text>150rpx Circle</text>
        </view>

        {/* Measurement display */}
        <view
          id='measurement-display'
          style='margin-top: 20rpx; padding: 10rpx; background: #f8f9fa; border: 1px solid #dee2e6;'
        >
          <text style='font-size: 12px; font-weight: bold; display: block; margin-bottom: 5rpx;'>
            Real-time Measurements:
          </text>
          <text
            id='measurement-100rpx'
            style='display: block; font-size: 10px; margin: 2px 0;'
          >
            100rpx element width: <span id='width-100rpx'>-</span>
          </text>
          <text
            id='measurement-200rpx'
            style='display: block; font-size: 10px; margin: 2px 0;'
          >
            200rpx element width: <span id='width-200rpx'>-</span>
          </text>
          <text
            id='measurement-300rpx'
            style='display: block; font-size: 10px; margin: 2px 0;'
          >
            300rpx element width: <span id='width-300rpx'>-</span>
          </text>
        </view>
      </lynx-view>

      {/* Outside container (should use default --rpx) */}
      <view
        id='outside-container'
        style='margin-top: 20rpx; padding: 10rpx; background: #e9ecef;'
      >
        <text style='font-size: 12px; font-weight: bold; display: block; margin-bottom: 10rpx;'>
          Outside lynx-view (uses global --rpx):
        </text>

        <view
          id='outside-element-100rpx'
          style='width: 100rpx; height: 40rpx; background: #6c757d; color: white; padding: 5rpx; margin: 5rpx 0;'
        >
          <text style='font-size: 11px;'>100rpx (global)</text>
        </view>
      </view>
    </page>
  );
}

root.render(<App></App>);
