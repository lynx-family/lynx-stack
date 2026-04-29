# Turbo Build Cache Scope Design

## Context

`pnpm turbo build` currently experiences large cache-miss fanout after unrelated source edits.

The main trigger is the root transit task in `turbo.json`:

- root `build` depends on `//#build`
- `//#build` is `cache: false`
- `//#build.inputs` currently includes repo-wide source globs such as `**/*.{ts,tsx}`

This makes unrelated edits, including files outside the normal `turbo build` surface like `website/theme/Layout.tsx`, change the `//#build` hash and invalidate many downstream build tasks.

## Goal

Reduce spurious cache misses during `pnpm turbo build` while keeping root-level invalidation limited to true shared config.

## Non-Goals

- Do not audit the full monorepo build graph beyond the root `build -> //#build` edge implicated by the cache fanout, except where targeted verification proves a package-local edge is redundant.

## Approaches Considered

### 1. Narrow `//#build.inputs` to explicit root files

This reduces miss fanout compared with repo-wide globs, but it still uses `//#build` as a global invalidation carrier.

Pros:

- Small change
- Better than repo-wide source globs

Cons:

- Keeps two concerns mixed together: root config invalidation and `tsc --build` execution
- Still easy to make too broad or too narrow

### 2. Use `globalDependencies` for real global config and make `//#build` inputless

This separates concerns:

- Turbo global hash handles true root-wide config invalidation
- `//#build` exists only to run `tsc --build` and rely on TypeScript incremental state

Pros:

- Small change
- Clearer ownership of invalidation behavior

- Cons:

- Does not fix the graph-level problem if root `build` still depends on `//#build`
- Depends more on package-local inputs and task dependencies being accurate
- Requires care in selecting the first `globalDependencies` set

### 3. Remove root `build -> //#build`

This changes the task topology, but it directly addresses the remaining shared invalidation carrier.

Pros:

- Removes the shared edge that keeps `//#build` in every root build chain
- Matches the successful summarized-build runs

Cons:

- Slightly larger semantic change than inputs-only tuning
- Still requires follow-up graph review if other root transit edges appear later

## What Happened

The first implementation attempt used approach 2:

- added `globalDependencies: ["./tsconfig.json"]`
- changed `//#build.inputs` to `[]`
- kept root `build.dependsOn: ["//#build", "^build"]`

That change did not fully solve the issue because `//#build` still sat in the shared root build chain.

## Effective Design

The working fix combines approach 2 with the root graph change from approach 3.

### Turbo configuration changes

Update the root `turbo.json` as follows:

1. Add:

```json
"globalDependencies": ["./tsconfig.json"]
```

2. Change `//#build.inputs` to an empty list:

```json
"inputs": []
```

3. Keep this setting unchanged:

- `//#build.cache: false`

4. Remove `//#build` from root `build.dependsOn`:

```json
"build": {
  "dependsOn": ["^build"]
}
```

## Why `tsconfig.json` Only

The first iteration keeps the global dependency set intentionally narrow.

`./tsconfig.json` is the strongest candidate for true global invalidation because many package `tsconfig` files extend it directly or indirectly. A change there can affect TypeScript behavior across a wide portion of the monorepo.

`./turbo.json` and `./pnpm-workspace.yaml` are not included in the first iteration because:

- `turbo.json` changes often affect task definitions selectively and are likely too broad for unconditional all-task invalidation
- `pnpm-workspace.yaml` changes are likely to overlap with task discovery or lockfile-driven invalidation already handled elsewhere

If later verification shows a real stale-hit risk from excluding either file, they can be added in a follow-up patch.

## Observed Result

After the graph change, summarized builds succeeded with these run files:

- `.turbo/runs/3CzPbKOfK2E02daN6jRk4f5coRl.json`
- `.turbo/runs/3CzPdAbefKMG0fnjRpM3hXhIqu1.json`

The baseline miss list from the second run was exactly:

- `//#build`
- `@lynx-js/benchmark-react#build`

This is the behavior the earlier inputs-only design was trying to produce, but it was only achieved once root `build` stopped depending on `//#build`.

Follow-up targeted validation also proved two package-local `//#build` edges were redundant and could be removed without changing effective cache behavior:

- `packages/lynx/gesture-runtime/turbo.jsonc`
- `packages/motion/turbo.jsonc`

For each package, a targeted `build` run was validated once with `--cache=local:r,local:w` disabled to force execution and again with cache replay enabled. Both packages kept the expected cold-run result and then replayed cleanly from cache after removing the local `//#build` dependency.

The corresponding verification evidence was:

- `gesture-runtime`: `.turbo/runs/3CzV8ARhzQtfjCvhIf5vR3gwHlQ.json`, `.turbo/runs/3CzV8xsLdXQmV4yV8ggmhVFSNHq.json`
- `motion`: `.turbo/runs/3CzVSf7GZwbGBfUtL9vMqs2RxBg.json`, `.turbo/runs/3CzVT9j0XS7HmwSB2HsGUvUxwnG.json`

After those removals, full-build verification was re-run and the baseline/website-edit miss set still remained exactly:

- `//#build`
- `@lynx-js/benchmark-react#build`

Verified in:

- `.turbo/runs/3CzVgLE6FZVtP7LuQcBhlOGUBbg.json`
- `.turbo/runs/3CzVi4cIYpZn6maZXW6emkUDRrV.json`

## Expected Behavior After Change

### Unrelated non-global source edits

Editing a file like `website/theme/Layout.tsx` should no longer trigger broad build fanout through the root `build` chain.

### Root TypeScript config edits

Editing root `tsconfig.json` should still invalidate tasks through Turbo's global hash, which matches the intended semantics.

### `//#build` execution behavior

`//#build` will still run on each build because `cache: false` remains in place. The execution cost should rely primarily on TypeScript's incremental build state rather than Turbo cache replay.

## Validation Plan

Run the same three-stage verification used during investigation:

1. Run `NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize`
2. Run the same command again and record miss count and miss tasks
3. Modify an unrelated non-global file such as `website/theme/Layout.tsx`
4. Run the same command a third time
5. Compare the second and third summaries

### Success criteria

- Second run remains near the current baseline miss set
- Third run does not recreate the previous fanout miss set caused by `//#build`
- Tasks that do not depend on the changed file or true global config continue to hit cache

## Risks

### Risk: stale hits from under-specified global config

If some builds implicitly depend on root-level files other than `tsconfig.json`, those tasks may keep hitting cache after a relevant root config change.

Mitigation:

- Keep this change narrow and verify behavior explicitly
- If needed, add more root files to `globalDependencies` in follow-up work based on concrete evidence

### Risk: other hidden root graph couplings remain

Removing the root `build -> //#build` edge fixed the observed issue, but other shared root transit edges could still create similar fanout later.

Mitigation:

- Keep future root transit tasks narrowly scoped
- Validate any new root edge with the same summarized-build comparison

## Follow-Up Work

If later builds show stale-hit risk or missing prerequisites, audit which tasks actually need an explicit dependency on `//#build` and add those edges locally rather than restoring a shared root dependency.
