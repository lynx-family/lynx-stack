import { Background, root } from '@lynx-js/react'

import { HeavyApp } from './HeavyApp.js'
import { Skeleton } from './Skeleton.js'

root.render(
  <page>
    <Background fallback={<Skeleton />}>
      <HeavyApp />
    </Background>
  </page>,
)
