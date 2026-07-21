---
applyTo: "benchmark/react/**"
---

Keep benchmark variants that are intended for comparison in separate bundles with the same element count, final attributes, and values. Change only the behavior under measurement.

Register each React benchmark case in `lynx.config.js`, add matching `bench:*` and `perfetto:*` scripts, include `src/patchProfile.ts`, and render `RunBenchmarkUntilHydrate` so `benchx_cli` uses the same completion marker.
