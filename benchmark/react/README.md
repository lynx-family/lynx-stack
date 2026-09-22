# ReactLynx benchmarks

The default build produces Snapshot bundles in `dist/` and Element Template
bundles in `dist/et/` from shared case sources. `lynx.et.config.js` selects ET
through `createBenchmarkConfig(true)`. The initial ET cases cover four-layer
view hydration (`007`) and full attribute updates with `useState` (`018`).

Snapshot metric names stay unchanged. ET profile, update, and script-loading
metrics use the `benchmark/react/et` path and an `et-` case-name prefix (for
example, `et-007-four-layer-views-hydrate`) so the backend is visible in CodSpeed
reports as well as having its own baseline. Renaming the ET cases creates new
benchmark identities; results recorded under the previous names remain separate.
Internal profiling spans are backend-specific; equal workload does not imply
that individual Snapshot and ET spans measure equivalent work.

## Build and run

From the repository root, install dependencies and build with Turbo:

```sh
pnpm install --frozen-lockfile
pnpm turbo build
```

The CI `bench` and `perfetto` scripts run both Snapshot and ET variants.
Use `bench-et` and `perfetto-et` to run only the ET cases.
For a focused local run with a compatible `benchx_cli` installed:

```sh
pnpm --filter @lynx-js/benchmark-react bench:et-007-four-layer-views
pnpm --filter @lynx-js/benchmark-react bench:et-018-use-state-full-attribute-update
```

The runner version is pinned in `packages/lynx/benchx_cli/scripts/build_unix.sh`.
The download step runs only with `CI=1`; to install the pinned runner locally,
run this command from the repository root:

```sh
CI=1 pnpm turbo build --filter benchx_cli
```

A bundle build alone does not validate native execution. When upgrading the
runner, verify that both backends reach `stop-benchmark-true`, report nonempty
metrics in simulation and walltime, and preserve the Snapshot trace leak check.

The existing leak checker scans Snapshot traces in `dist/`. ET traces are saved
under `dist/et/` and uploaded for inspection, but do not yet participate in leak
assertions: ET constructor events may contain the provisional ID `-1`, while
destructor events contain assigned IDs. Pairing these events by ID cannot
establish ET object lifetime balance.

Update measurements end in the background effect observing the updated state.
The native completion marker keeps the runner alive until that measurement has
been registered; the metric does not measure completion of native painting.

## Adding shared cases

Add an ET entry selection and matching `bench:et-*` / `perfetto:et-*` scripts.
Keep ET trace outputs at `dist/et/<case>.ptrace`. CI uploads traces from both
backend directories; the Snapshot-only leak checker continues to scan `dist/`.

`004-various-update` hooks Snapshot-private classes and attribute slots, so its
instrumentation needs a separate ET implementation. `003-hello-list` requires
verification of ET list callback instrumentation before inclusion.
