import { Background, root } from '@lynx-js/react'

import { Deferred } from './Deferred.js'
import { Header } from './Header.js'

// The boundary names the island itself, so the fold keeps it: the main thread
// compiles `Header` and renders it where the boundary sat, and only what the
// boundary defers goes away.
root.render(
  <Background island={<Header />} fallback={<view className='skeleton' />}>
    <Deferred />
  </Background>,
)
