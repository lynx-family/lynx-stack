---
applyTo: "benchmark/react/**"
---

Keep benchmark variants that are intended for comparison in separate bundles with the same element count, final attributes, and values. Change only the behavior under measurement.

Assign consecutive case numbers to state-mechanism comparisons, with the `useState` variant first and the matching `useSignal` variant immediately after it.

Use 100 logical workload items in update-comparison cases. A local-update case should contain 99 static items and one target item at index 50. Do not count the Codspeed completion marker as a workload item.

Register each React benchmark case in `lynx.config.js` and add identically named `bench:*` and `perfetto:*` scripts. Profile-derived benchmarks should include `src/patchProfile.ts`. Hydration benchmarks should render `RunBenchmarkUntilHydrate` so `benchx_cli` uses the shared hydration completion marker.

When a benchmark measures an asynchronous UI update instead of hydration, expose `id="stop-benchmark-true"` only after the update is rendered and configure `benchx_cli` to wait for that id.

End-to-end update benchmarks should call `startUpdateBenchmark` immediately before the state mutation and pass the case entry's `__REPO_FILEPATH__` to `useUpdateBenchmarkCompletion` so it stops and registers a case-specific Codspeed measurement from an effect that observes the committed update. Do not use `__webpack_chunkname__` for the metric name because it resolves to an inner chunk such as `background.js` in Lynx bundles. Drive the `stop-benchmark-true` marker from the returned completion state so `benchx_cli` cannot finish before Codspeed records the result. Do not include `src/patchProfile.ts` in these entries because its profile hooks would create nested measurements instead of one update span.

When comparing state mechanisms, keep the `useState` and `useSignal` variants in separate bundles and make their entry components differ only in how the state is stored, read, and updated. Put the render workload in a shared component under `benchmark/react/src` and trigger the same initial-to-updated transition from `useEffect`. Pass a reader function into the shared tree so signals subscribe at the component that owns the changing render workload instead of being unwrapped in the entry component. Invoke the reader once in the target leaf for subscription-locality updates and independently in every keyed leaf for full fan-out updates. Pass a primitive prop only when a benchmark explicitly intends to measure parent prop propagation without signal subscription behavior.

Keep the state-mechanism update suite focused on two pure attribute-update comparisons: local and full. Both should preserve element types, keys, order, and count and change only attribute values, apart from the completion-marker attribute. A local case should invoke the reader in one subscribed leaf among an otherwise static collection, while a full case should invoke the reader independently in every keyed leaf and update the corresponding attribute on every item. Use one separate completion leaf so multiple signal subscribers do not stop or register the Codspeed measurement repeatedly.

In `@preact/signals` benchmark variants, read `.value` during a component render before passing the resulting primitive value to a Lynx element in JSX. The read may happen through a shared reader function when the benchmark measures subscription locality. Passing a Signal object directly to a Lynx element uses Preact's browser-oriented DOM mutation path and bypasses the ReactLynx snapshot update pipeline.

When adding `@preact/signals` to the benchmark package, also declare `preact: "catalog:lynxjs"` in `devDependencies`. This satisfies the Signals peer with ReactLynx's internal Preact build and prevents `pnpm dedupe --check` from introducing a separate public Preact version.

When `benchmark/react/lynx.config.js` enables builtin attribute-name transformation, declare the React-style aliases used by the benchmark explicitly in `benchmark/react/types/index.d.ts` and reference their original Lynx prop types with indexed access. Key-remapped mapped types provide type checking but not reliable completion documentation or definition navigation.
