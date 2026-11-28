---
'@lynx-js/islands': minor
---

Keep Islands in the host bundle and expose only the build plugin and ReactLynx component. Register XML paths with `pluginIslands({ exposes })`, then render `<Island name="card" props={data} />`; container IDs, loading, background readiness and native commits are handled internally.

Remove remote delivery, the runtime and shared package entry points, and the public `useIsland` hook. Replace the build plugin's `output` option with `entry` for selecting a host entry. Preserve synchronous first-frame rendering, independent background initialization and instance reuse across hydration without changing the ReactLynx worklet runtime.
