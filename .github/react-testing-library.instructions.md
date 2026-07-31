---
applyTo: "packages/react/testing-library/**"
---

When using `@lynx-js/react-signals` in ReactLynx testing-library tests, read `.value` in JSX so signal changes rerender through the ReactLynx snapshot pipeline. Do not pass a Signal object directly as a JSX child: that optimization mutates a browser text node directly and does not update the Lynx element tree.

Consume Signals through `@lynx-js/react-signals`; do not add direct `@preact/signals`, `@preact/signals-core`, or `preact` dependencies. The adapter package owns the compatible implementation and peer resolution.
