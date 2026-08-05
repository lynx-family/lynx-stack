import { Background, root } from '@lynx-js/react'

import { Deferred } from './Deferred.js'

// The island sits inside the subtree the root `<Background>` defers, so the
// fold removes it along with everything else under the boundary.
root.render(
  <Background fallback={<view className='skeleton' />}>
    <Deferred />
  </Background>,
)
