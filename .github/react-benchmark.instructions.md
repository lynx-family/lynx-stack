---
applyTo: "benchmark/react/**"
---

Keep benchmark variants that are intended for comparison in separate bundles with the same element count, final attributes, and values. Change only the behavior under measurement.

Register each React benchmark case in `lynx.config.js`, add matching `bench:*` and `perfetto:*` scripts, include `src/patchProfile.ts`, and render `RunBenchmarkUntilHydrate` so `benchx_cli` uses the same completion marker.

When `benchmark/react/lynx.config.js` enables builtin attribute-name transformation, declare the React-style aliases used by the benchmark explicitly in `benchmark/react/types/index.d.ts` and reference their original Lynx prop types with indexed access. Key-remapped mapped types provide type checking but not reliable completion documentation or definition navigation.
