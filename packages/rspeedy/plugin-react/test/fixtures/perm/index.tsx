import { Background as B, root } from '@lynx-js/react'

import * as UI from './UI.js'
import { ComputedInner } from './Computed.js'
import { DeferredA } from './DeferredA.js'
import { renderDeferred } from './DeferredCall.js'
import { DeferredWorklet } from './DeferredWorklet.js'
import { Nested } from './Nested.js'
import { Shell } from './Shell.js'
import { Skeleton } from './Skeleton.js'
import { Slotted } from './Slotted.js'
import { Wrapper } from './Wrapper.js'

// F: the component reference is only known at runtime.
const Picked = Math.random() > 2 ? ComputedInner : ComputedInner

root.render(
  <page>
    {/* not deferred — must keep rendering on the main thread */}
    <Shell />

    {/* A/B: aliased <B>, plain child */}
    <B fallback={<Skeleton />}>
      <DeferredA />
    </B>

    {/* C: namespace member expression */}
    <B fallback={<Skeleton />}>
      <UI.Card />
    </B>

    {/* D: the child comes from a call, not a JSX identifier */}
    <B fallback={<Skeleton />}>{renderDeferred()}</B>

    {/* E: the child is written OUTSIDE the boundary and slotted in */}
    <Wrapper>
      <Slotted />
    </Wrapper>

    {/* F: runtime-computed component */}
    <B fallback={<Skeleton />}>
      <Picked />
    </B>

    {/* G: boundary nested inside a first-screen component */}
    <Nested />

    {/* H: boundary produced inside a map */}
    {[0].map(i => (
      <B key={i} fallback={<Skeleton />}>
        <DeferredWorklet />
      </B>
    ))}
  </page>,
)
