---
applyTo: "packages/react/testing-library/**"
---

When using `@preact/signals` in ReactLynx testing-library tests, read `.value` in JSX so signal changes rerender through the ReactLynx snapshot pipeline. Do not pass a Signal object directly as a JSX child: that optimization mutates a browser text node directly and does not update the Lynx element tree.

When adding `@preact/signals`, also declare `preact: "catalog:lynxjs"` in `devDependencies`. This satisfies the Signals peer with ReactLynx's internal Preact build and prevents `pnpm dedupe --check` from introducing a separate public Preact version.
