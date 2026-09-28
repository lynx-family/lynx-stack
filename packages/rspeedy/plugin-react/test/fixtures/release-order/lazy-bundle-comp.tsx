// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export default function LazyBundleComp() {
  const onTap = () => {
    'main thread'
  }

  return (
    <view bindtap={onTap}>
      <text>lazy release-order</text>
    </view>
  )
}
