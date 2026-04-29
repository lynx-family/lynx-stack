# Turbo Build Cache Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `pnpm turbo build` cache-miss fanout from unrelated source edits by moving true root invalidation to Turbo's global hash and removing `//#build` from the shared root `build` chain.

**Architecture:** The first inputs-only attempt was insufficient. The working change keeps `globalDependencies: ["./tsconfig.json"]` and `//#build.inputs: []`, but also removes `//#build` from root `build.dependsOn` so the root build no longer fans that task out across unrelated package builds. Follow-up cleanup also removed redundant package-local `//#build` edges from `packages/lynx/gesture-runtime/turbo.jsonc` and `packages/motion/turbo.jsonc` after targeted cold-run and cache-replay validation. Final full-build verification evidence: `.turbo/runs/3CzVgLE6FZVtP7LuQcBhlOGUBbg.json` and `.turbo/runs/3CzVi4cIYpZn6maZXW6emkUDRrV.json`, with the miss list still exactly `//#build` and `@lynx-js/benchmark-react#build`.

**Tech Stack:** Turborepo 2.9, pnpm, TypeScript incremental build (`tsc --build`), `jq`, git

---

## File Structure

- Modify: `turbo.json`
- Add `globalDependencies: ["./tsconfig.json"]`
- Replace `//#build.inputs` repo-wide globs with `[]`
- Remove `//#build` from root `build.dependsOn`
- Keep `//#build.cache` unchanged
- Modify: `packages/lynx/gesture-runtime/turbo.jsonc`
  - Remove redundant package-local `//#build` from `build.dependsOn`
- Modify: `packages/motion/turbo.jsonc`
  - Remove redundant package-local `//#build` from `build.dependsOn`
- Modify temporarily during verification only: `website/theme/Layout.tsx`
  - Insert and later remove a single comment line to simulate an unrelated non-global source edit
- Create or update: `.github/turbo-cache.instructions.md`
  - Document the cache-scoping rule so future edits do not restore repo-wide invalidation

### Task 1: Reproduce the Current Fanout Miss

**Files:**

- Modify temporarily: `website/theme/Layout.tsx`

- [ ] **Step 1: Warm the current Turbo state with one summarized build**

Run:

```bash
NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize --output-logs=none
```

Expected: command succeeds and prints a `Summary:` path under `.turbo/runs/`.

- [ ] **Step 2: Run the baseline summarized build and record the miss set**

Run:

```bash
NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize --output-logs=none
run=$(ls -t .turbo/runs/*.json | head -n1)
jq -r '.tasks[] | select(.cache.status=="MISS") | .taskId' "$run"
```

Expected: the miss list is the small baseline set and includes only:

```text
//#build
@lynx-js/benchmark-react#build
```

- [ ] **Step 3: Add a temporary comment to `website/theme/Layout.tsx`**

Apply this edit:

```tsx
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Cache-scope verification marker.
import { useLang } from '@rspress/core/runtime';
import { Banner, Layout as BasicLayout } from '@rspress/core/theme-original';

export const Layout = () => {
  const lang = useLang();
  return (
    <BasicLayout
      beforeNav={
        <Banner
          href='https://lynxjs.org'
          storage={false}
          message={lang === 'en'
            ? 'This is the dev preview website. Check out the document at lynxjs.org'
            : '这是开发预览网站。请访问正式文档 lynxjs.org'}
        />
      }
    />
  );
};
```

- [ ] **Step 4: Run the third summarized build and confirm the unrelated edit fans out**

Run:

```bash
NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize --output-logs=none
run=$(ls -t .turbo/runs/*.json | head -n1)
jq -r '.tasks[] | select(.cache.status=="MISS") | .taskId' "$run"
```

Expected: the miss list expands well beyond the two-task baseline and includes unrelated tasks such as:

```text
@lynx-js/react#build
@lynx-js/rspeedy#build
@lynx-js/web-tests#build
```

- [ ] **Step 5: Remove the temporary verification comment**

Restore `website/theme/Layout.tsx` to exactly:

```tsx
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useLang } from '@rspress/core/runtime';
import { Banner, Layout as BasicLayout } from '@rspress/core/theme-original';

export const Layout = () => {
  const lang = useLang();
  return (
    <BasicLayout
      beforeNav={
        <Banner
          href='https://lynxjs.org'
          storage={false}
          message={lang === 'en'
            ? 'This is the dev preview website. Check out the document at lynxjs.org'
            : '这是开发预览网站。请访问正式文档 lynxjs.org'}
        />
      }
    />
  );
};
```

### Task 2: Implement and Verify the Root Cache-Scope Fix

**Files:**

- Modify: `turbo.json`

- [ ] **Step 1: Edit `turbo.json` to move root invalidation into `globalDependencies` and drop the shared root `//#build` edge**

Replace the file contents with:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "globalDependencies": [
    "./tsconfig.json"
  ],
  "globalPassThroughEnv": [
    "CI",
    "COREPACK_INTEGRITY_KEYS",
    "COREPACK_NPM_REGISTRY",
    "COREPACK_DEFAULT_TO_LATEST",
    "NODE_OPTIONS"
  ],
  "ui": "tui",
  "tasks": {
    "api-extractor": {
      "dependsOn": [
        "//#build"
      ],
      "cache": false
    },
    "build": {
      "dependsOn": [
        "^build"
      ]
    },
    "test": {
      "dependsOn": [],
      "cache": false
    },
    "//#build": {
      "cache": false,
      "dependsOn": [],
      "inputs": []
    }
  }
}
```

- [ ] **Step 2: Run one summarized build to confirm the config still executes successfully**

Run:

```bash
NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize --output-logs=none
```

Expected: command succeeds and prints a `Summary:` path under `.turbo/runs/`.

- [ ] **Step 3: Run a second summarized build to confirm the post-change baseline miss set**

Run:

```bash
NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize --output-logs=none
run=$(ls -t .turbo/runs/*.json | head -n1)
jq -r '.tasks[] | select(.cache.status=="MISS") | .taskId' "$run"
```

Expected: the baseline miss set remains small and is exactly:

```text
//#build
@lynx-js/benchmark-react#build
```

Record the two successful summary files as evidence:

- `.turbo/runs/3CzPbKOfK2E02daN6jRk4f5coRl.json`
- `.turbo/runs/3CzPdAbefKMG0fnjRpM3hXhIqu1.json`

- [ ] **Step 4: Do not commit as part of this iteration**

Expected: leave the change uncommitted for review or follow-up batching.

### Task 3: Remove Redundant Package-Local `//#build` Edges

**Files:**

- Modify: `packages/lynx/gesture-runtime/turbo.jsonc`
- Modify: `packages/motion/turbo.jsonc`

- [ ] **Step 1: Remove `//#build` from `build.dependsOn` in `packages/lynx/gesture-runtime/turbo.jsonc`**

Expected: package `build` depends only on the package tasks it actually needs.

- [ ] **Step 2: Validate `gesture-runtime` once with a cold targeted build and once with cache replay**

Evidence:

- cold run: `.turbo/runs/3CzV8ARhzQtfjCvhIf5vR3gwHlQ.json`
- cache replay: `.turbo/runs/3CzV8xsLdXQmV4yV8ggmhVFSNHq.json`

- [ ] **Step 3: Remove `//#build` from `build.dependsOn` in `packages/motion/turbo.jsonc`**

Expected: package `build` depends only on the package tasks it actually needs.

- [ ] **Step 4: Validate `motion` once with a cold targeted build and once with cache replay**

Evidence:

- cold run: `.turbo/runs/3CzVSf7GZwbGBfUtL9vMqs2RxBg.json`
- cache replay: `.turbo/runs/3CzVT9j0XS7HmwSB2HsGUvUxwnG.json`

### Task 4: Verify the Unrelated Edit No Longer Fans Out

**Files:**

- Modify temporarily: `website/theme/Layout.tsx`

- [ ] **Step 1: Re-apply the temporary verification comment**

Apply this edit:

```tsx
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Cache-scope verification marker.
import { useLang } from '@rspress/core/runtime';
import { Banner, Layout as BasicLayout } from '@rspress/core/theme-original';

export const Layout = () => {
  const lang = useLang();
  return (
    <BasicLayout
      beforeNav={
        <Banner
          href='https://lynxjs.org'
          storage={false}
          message={lang === 'en'
            ? 'This is the dev preview website. Check out the document at lynxjs.org'
            : '这是开发预览网站。请访问正式文档 lynxjs.org'}
        />
      }
    />
  );
};
```

- [ ] **Step 2: Run the third summarized build and inspect the miss list**

Run:

```bash
NODE_OPTIONS="--max-old-space-size=32768" pnpm turbo build --summarize --output-logs=none
run=$(ls -t .turbo/runs/*.json | head -n1)
jq -r '.tasks[] | select(.cache.status=="MISS") | .taskId' "$run"
```

Expected: the miss list stays near the post-change baseline and does **not** contain unrelated tasks such as:

```text
@lynx-js/react#build
@lynx-js/rspeedy#build
@lynx-js/web-tests#build
```

- [ ] **Step 3: Remove the temporary verification comment and confirm the worktree is clean**

Run:

```bash
git diff -- website/theme/Layout.tsx
```

Expected: no diff for `website/theme/Layout.tsx` after restoring the file to:

```tsx
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { useLang } from '@rspress/core/runtime';
import { Banner, Layout as BasicLayout } from '@rspress/core/theme-original';

export const Layout = () => {
  const lang = useLang();
  return (
    <BasicLayout
      beforeNav={
        <Banner
          href='https://lynxjs.org'
          storage={false}
          message={lang === 'en'
            ? 'This is the dev preview website. Check out the document at lynxjs.org'
            : '这是开发预览网站。请访问正式文档 lynxjs.org'}
        />
      }
    />
  );
};
```

Record the final full-build verification evidence after the package-level cleanup:

- `.turbo/runs/3CzVgLE6FZVtP7LuQcBhlOGUBbg.json`
- `.turbo/runs/3CzVi4cIYpZn6maZXW6emkUDRrV.json`

Expected: both runs keep the correct miss set:

```text
//#build
@lynx-js/benchmark-react#build
```

### Task 5: Record the Guardrail for Future Turbo Edits

**Files:**

- Create or modify: `.github/turbo-cache.instructions.md`

- [ ] **Step 1: Write the Turbo cache guidance file**

Set `.github/turbo-cache.instructions.md` to:

```md
---
applyTo: "{turbo.json,**/turbo.json,**/turbo.jsonc}"
---

Keep root transit tasks like `//#build` narrowly scoped. Do not use repo-wide globs such as `**/*.{ts,tsx}` for shared invalidation unless every downstream build really needs to miss when any TypeScript file anywhere changes.
When a package does not participate in `turbo build` (for example a package that only defines `build:docs`), edits in that package should not invalidate unrelated build tasks. Prefer package-local `inputs` or a short list of truly shared config files over broad root-level source globs.
Do not make shared root `build` defaults depend on repo-scoped root transit tasks such as `//#build` unless every build truly needs that root task. Prefer explicit per-task `dependsOn` entries for the builds that actually require the shared root transit task.
If a package only needs the root `tsconfig.json` or upstream workspace package builds, prefer `$TURBO_ROOT$/tsconfig.json` or root `globalDependencies` plus `^build` over a direct `//#build` dependency.
```

- [ ] **Step 2: Run a final status check before committing the documentation guardrail**

Run:

```bash
git status --short
```

Expected: the worktree contains the documentation/config changes for review; do not rely on an intermediate commit from Task 2.

- [ ] **Step 3: Leave the guardrail documentation uncommitted**

Expected: documentation changes remain available for a later explicit commit.
