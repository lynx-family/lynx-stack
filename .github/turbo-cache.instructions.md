---
applyTo: "{turbo.json,**/turbo.json,**/turbo.jsonc}"
---

Keep root transit tasks like `//#build` narrowly scoped. Do not use repo-wide globs such as `**/*.{ts,tsx}` for shared invalidation unless every downstream build really needs to miss when any TypeScript file anywhere changes.
When a package does not participate in `turbo build` (for example a package that only defines `build:docs`), edits in that package should not invalidate unrelated build tasks. Prefer package-local `inputs` or a short list of truly shared config files over broad root-level source globs.
Do not make shared root `build` defaults depend on repo-scoped root transit tasks such as `//#build` unless every build truly needs that root task. Prefer explicit per-task `dependsOn` entries for the builds that actually require the shared root transit task.
If a package only needs the root `tsconfig.json` or upstream workspace package builds, prefer `$TURBO_ROOT$/tsconfig.json` or root `globalDependencies` plus `^build` over a direct `//#build` dependency.
