# Element Template Tests

This directory contains the dedicated test suite for `src/element-template/**`.

## Layout

- `runtime/`: tests mapped to runtime implementation areas under `src/element-template/runtime/`.
- `runtime/background/`: tests for background-side document, instance, commit, and render behavior.
- `native/`: tests for native entrypoints and thread bridge setup.
- `debug/`: tests for Element Template specific debug and profiling hooks.
- `lynx/`: tests for Lynx-facing timing and performance integration.
- `internal/`: tests for internal compatibility or guard behavior.
- `imports/`: guardrail tests that enforce import boundaries or entrypoint constraints.
- `fixtures/`: fixture data used by integration-style suites.
- `test-utils/`: mocks, serializers, fixture runners, and shared ET-only helpers.

## Test Layers

- `imports/` and `internal/` are architecture guardrails.
  They should stay stable unless the ET entrypoint boundary itself changes.
- Narrow module tests under `runtime/`, `native/`, `debug/`, and `lynx/` primarily validate local module behavior.
  They may move when source modules are split or renamed, but their behavioral assertions should remain stable.
- Fixture-driven suites validate cross-module contracts.
  These are the primary protection for render, hydration, patch, and compiled ET flows.

## Test Infrastructure Roles

- `test-utils/mock/` owns fake native and environment surfaces:
  - mock native PAPI
  - mock JSContext
  - performance / global setup helpers
- `test-utils/debug/` owns ET-specific execution helpers:
  - fixture runners
  - compiled render runners
  - serializer / template registry helpers
  - debug-only thread or update runners
- When runtime internals are refactored, prefer updating `test-utils/debug/` adapters instead of rewriting many suites independently.

## Placement Rules

- If a test targets one source module or one small group of closely related modules, place it under the matching source-domain directory.
- If a test validates a render, hydrate, patch, or background flow across multiple modules, prefer a fixture-based suite.
- Prefer `case.ts` / `case.tsx` fixtures by default. Use `index.tsx` fixtures only when the test is intentionally blessing compiled output and template registration together with runtime render.
- Put import-boundary and architecture guardrail tests in `imports/` instead of the root.
- Avoid adding new root-level test files unless the test truly spans multiple top-level ET domains.

## Fixture Conventions

- Fixture directories live under `fixtures/` and should mirror the owning test domain, for example `fixtures/patch/` or `fixtures/background/render/`.
- A fixture case is discovered when a directory contains `case.ts`, `case.tsx`, or `index.tsx`.
- Most case-driven suites should use `runCaseModuleFixtureTests(...)` from [test-utils/debug/fixtureRunner.ts](/Users/bytedance/lynx/workspace.worktrees/element-template-demo/rspeedy/lynx-stack/packages/react/runtime/__test__/element-template/test-utils/debug/fixtureRunner.ts).
- Compiled render fixtures should use [test-utils/debug/renderFixtureRunner.ts](/Users/bytedance/lynx/workspace.worktrees/element-template-demo/rspeedy/lynx-stack/packages/react/runtime/__test__/element-template/test-utils/debug/renderFixtureRunner.ts) so compile, template blessing, and render assertions stay in one ET-specific runner instead of being reimplemented per suite.
- Expected `lynx.reportError` calls should be declared via `reportErrorCount` on fixture case modules or asserted locally and then reset explicitly before teardown.

## Stability Rules

- Refactors may change helper names, file locations, or runner internals, but should not silently relax:
  - contract test assertions
  - fixture output shape
  - import-boundary guardrails
- If a runtime refactor requires broad test updates, update the shared runner or adapter layer first, then keep high-level contract expectations intact where possible.

## Commands

Run the ET suite from `packages/react/runtime/`:

```bash
pnpm test:et
```

When debugging config-loader issues locally, this fallback runs the same suite without changing test semantics:

```bash
pnpm exec vitest run --configLoader runner -c __test__/element-template/vitest.config.ts
```
