import { Background, root } from '@lynx-js/react'
import { FeedA } from './FeedA.js'
import { FeedB } from './FeedB.js'
import { Middle } from './Middle.js'
import { SkeletonA } from './SkeletonA.js'
import { SkeletonB } from './SkeletonB.js'
root.render(
  <page>
    <Background fallback={<SkeletonA />}>
      <FeedA />
    </Background>
    <Middle />
    <Background fallback={<SkeletonB />}>
      <FeedB />
    </Background>
  </page>,
)
