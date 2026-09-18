---
"@lynx-js/tailwind-preset": minor
---

**BREAKING:** Align composed `skew-x-*` and `skew-y-*` utilities with Tailwind
CSS v3 by emitting `skewX(...) skewY(...)`. Elements combining both axes now
use Tailwind's matrix composition instead of the previous two-argument
`skew(...)` behavior. To preserve the previous geometry, migrate to a complete
arbitrary transform such as `transform-[skew(12deg,6deg)]`.
