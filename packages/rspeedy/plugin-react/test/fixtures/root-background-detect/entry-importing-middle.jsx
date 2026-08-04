import { root } from '@lynx-js/react'

import { Middle } from './middle-with-background.js'

// The entry itself has no `<Background>`; the boundary is one import away.
root.render(
  <page>
    <Middle />
  </page>,
)
