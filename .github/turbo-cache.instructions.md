---
applyTo: "{turbo.json,**/turbo.json,**/turbo.jsonc}"
---

Keep root transit tasks like `//#build` narrowly scoped. Do not use repo-wide globs such as `**/*.{ts,tsx}` for shared invalidation unless every downstream build really needs to miss when any TypeScript file anywhere changes.
When a package does not participate in `turbo build` (for example a package that only defines `build:docs`), edits in that package should not invalidate unrelated build tasks. Prefer package-local `inputs` or a short list of truly shared config files over broad root-level source globs.
Do not make shared root `build` defaults depend on repo-scoped root transit tasks such as `//#build` unless every build truly needs that root task. Prefer explicit per-task `dependsOn` entries for the builds that actually require the shared root transit task.
If a package only needs the root `tsconfig.json` or upstream workspace package builds, prefer `$TURBO_ROOT$/tsconfig.json` or root `globalDependencies` plus `^build` over a direct `//#build` dependency.
When a package build consumes workspace `dist/**` output that is only materialized by the root TypeScript build, add an explicit per-package `dependsOn: ["//#build"]` instead of relying on task scheduling order.
If a Turbo task's build behavior depends on non-source config such as `rslib.config.ts`, `rsbuild.config.ts`, or package-level `tsconfig.json`, include those files in that task's `inputs` so cache hits cannot replay stale artifacts after config-only edits.
If `rslib.config.ts` reaches outside `src/**` for helper files such as custom loaders or a `tsconfig.build.json`, include those referenced files in `build.inputs` too; otherwise config changes may invalidate correctly while helper-file edits still replay stale cached output.
The CI code-style job runs API extraction without Rust installed, so keep `api-extractor` dependent on the root `//#build` typecheck path rather than package `build` tasks; fix missing workspace type output by adding TypeScript project references to the importing package instead.
Disable Turbo caching for build fixtures whose tests depend on intermediate files written during asynchronous build teardown, such as `examples/react-debug-metadata` retaining `debug-metadata.json` under `dist-*`; otherwise CI can snapshot a partially flushed output directory and replay incomplete artifacts in later jobs.
