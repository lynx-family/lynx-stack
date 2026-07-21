---
"@lynx-js/react-transform": patch
---

Fold compile-time constants into the static snapshot. A JSX expression that references a `const` binding with a literal initializer is now compiled as if the literal had been written inline, so `<view custom-attr={VALUE} />` becomes a static `__SetAttribute` instead of a dynamic value, and children that render nothing (`{null}`, `{true}`, `{false}`, or a `const` bound to one of them) no longer take up a slot.
