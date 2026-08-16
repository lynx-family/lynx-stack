// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mainThread } from '@lynx-js/react'
import { motion } from '@lynx-js/motion'

export default function DirectiveInferenceFixture() {
  const callback = mainThread((value: number) => value + 1)
  return (
    <view main-thread:bindtap={callback}>
      <motion.div
        initial={{ x: -42 }}
        animate={{ x: [-42, 0, 42] }}
        transition={{
          duration: 0.1,
          ease: [
            progress => progress,
            progress => progress * progress,
          ],
        }}
        transformTemplate={({ x }, generated) =>
          `translateY(${x}) ${generated}`}
      />
    </view>
  )
}
