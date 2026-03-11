# Extract vue-lynx into an Independent Repository

## Decisions

- **Repo name**: `vue-lynx` (private GitHub repo initially)
- **npm packages**: only **two** — `vue-lynx` and `create-vue-lynx`
- **Current internal names**: `@lynx-js/vue-*` (need consolidation — see below)

## Motivation

`packages/vue/` is self-contained enough to live in its own repo. Separating it
from lynx-stack would give the Vue Lynx effort its own release cadence, CI
pipeline, and contributor surface — while still integrating cleanly via npm.

## Feasibility Analysis

### Commit history

33 commits on `research/vue-lynx` touch `packages/vue/`.
Some also touch files outside; all are **integration glue**, not feature code:

| External file                                 | Commits | Nature                                                    |
| --------------------------------------------- | ------- | --------------------------------------------------------- |
| `pnpm-lock.yaml`                              | 6+      | Auto-generated; a standalone repo has its own             |
| `pnpm-workspace.yaml`                         | 2       | Registers `packages/vue/*`; not needed standalone         |
| Root `tsconfig.json`                          | 2       | Adds project references; not needed standalone            |
| `.gitmodules`                                 | 1       | Adds vuejs/core submodule (already under `packages/vue/`) |
| `biome.jsonc` + `eslint.config.js`            | 1       | Ignore-list entries for vue test dirs                     |
| `packages/testing-library/.../ElementPAPI.ts` | 1       | CSS custom property fix (`--*` setProperty)               |

Only the `ElementPAPI.ts` change is a real upstream fix — it should be PR'd back
to lynx-stack `main` independently. Everything else disappears once the repo is
standalone.

**Extraction command:**

```bash
git clone <lynx-stack> /tmp/vue-lynx
cd /tmp/vue-lynx
git filter-repo --path packages/vue/ --path-rename packages/vue/:
```

All commits preserved with original messages, authors, and dates.

### Dependency graph on lynx-stack

```
@lynx-js/vue-runtime
  └─ @lynx-js/types (type-only, published to npm)

@lynx-js/vue-main-thread
  └─ @lynx-js/type-element-api (type-only, published to npm)

@lynx-js/vue-rsbuild-plugin
  ├─ @lynx-js/template-webpack-plugin (published to npm)
  ├─ @lynx-js/runtime-wrapper-webpack-plugin (published to npm)
  └─ @lynx-js/react (only worklet-runtime portion)

@lynx-js/vue-internal
  └─ (no @lynx-js deps — pure shared code)
```

Runtime and main-thread have **zero runtime dependencies** on lynx-stack — only
type packages. The rspeedy-plugin's webpack dependencies are all published to npm.

The only tight coupling is `@lynx-js/react` for worklet-runtime. This can be
resolved by either extracting worklet-runtime into its own package or vendoring
the needed bits.

## Package Strategy: Two npm Packages

### Why consolidate

- `vue-lynx` runtime is ONLY used in Lynx projects, which always have the
  build plugin installed — no "runtime without plugin" scenario exists
- Internal packages (`main-thread`, `internal`) are never imported by users
- Fewer packages = fewer versions to coordinate, simpler install, less npm noise
- Subpath exports cleanly separate concerns without separate packages

### The two packages

| npm package           | Purpose                                                      |
| --------------------- | ------------------------------------------------------------ |
| **`vue-lynx`**        | Everything: runtime, plugin, main-thread, internals, testing |
| **`create-vue-lynx`** | Scaffolding CLI (`npm create vue-lynx`)                      |

`create-vue-lynx` must be separate because `npm create <name>` hardcodes
the lookup to `create-<name>`.

### `vue-lynx` subpath exports

```jsonc
{
  "name": "vue-lynx",
  "exports": {
    ".": "./runtime/dist/index.js", // createApp, ref, ...
    "./plugin": "./plugin/dist/index.js", // pluginVueLynx
    "./main-thread": "./main-thread/dist/entry-main.js", // require.resolve'd by plugin
    "./ops": "./internal/dist/ops.js", // OP enum (shared)
    "./testing": "./testing-library/dist/index.js" // render, fireEvent
  }
}
```

**User-facing imports:**

```typescript
// App code
import { createApp, ref, onMounted } from 'vue-lynx';

// lynx.config.ts
import { pluginVueLynx } from 'vue-lynx/plugin';

// test files
import { render, fireEvent } from 'vue-lynx/testing';
```

**Internal (users never write these):**

```typescript
// Inside plugin source — resolves main-thread entry for webpack
require.resolve('vue-lynx/main-thread');

// Inside runtime/main-thread — shared OP enum
import { OP } from 'vue-lynx/ops';
```

### Consolidation from current packages

| Current (`@lynx-js/`)          | → Subpath              | Notes                   |
| ------------------------------ | ---------------------- | ----------------------- |
| `@lynx-js/vue-runtime`         | `vue-lynx` (root)      | Main entry              |
| `@lynx-js/vue-rsbuild-plugin`  | `vue-lynx/plugin`      | Build plugin            |
| `@lynx-js/vue-main-thread`     | `vue-lynx/main-thread` | Internal                |
| `@lynx-js/vue-internal`        | `vue-lynx/ops`         | Shared OP enum          |
| `@lynx-js/vue-testing-library` | `vue-lynx/testing`     | Test utils              |
| `@lynx-js/vue-upstream-tests`  | (not exported)         | Dev-only, stays in repo |

### Design goals

1. **Minimize user-facing surface** — users learn two names, not six
2. **Don't expose build-tool internals** — no "rsbuild" in any import path
3. **Maximum migration flexibility** — flat name, no scope commitment

### Possible futures and migration paths

| Outcome                | What changes                                          |
| ---------------------- | ----------------------------------------------------- |
| Stay independent       | (nothing)                                             |
| Absorbed by `@lynx-js` | `vue-lynx` → `@lynx-js/vue` with same subpath exports |
| Endorsed by `@vue`     | `vue-lynx` → `@vue/lynx` with same subpath exports    |

In all cases: `npm deprecate vue-lynx "Moved to @xxx/yyy"`, publish one final
version that re-exports from the new name. Subpath structure stays identical.

### Execution plan

**Post-extraction, in vue-lynx repo:**

1. Restructure monorepo: each current package becomes a directory under the
   single `vue-lynx` package (they can still be separate build targets)
2. Add `exports` map to `vue-lynx/package.json`
3. Update all cross-package imports to use subpath imports
4. Consolidate `dependencies` into root `vue-lynx/package.json`
5. Update all docs and examples

Alternatively, keep the monorepo structure with `workspace:*` during
development, but publish as a single package via a build/prepublish script
that assembles the subpath exports. This gives the best of both worlds:
independent builds in dev, single package for consumers.

## Scaffolding: `create-vue-lynx`

### Design

`create-vue-lynx` is built on `create-rstack` (same foundation as
`create-rspeedy`), with template structure **identical to create-rspeedy's
conventions** so that future merge-back is trivial.

### Why not wrap/fork create-rspeedy

- `create-rspeedy --template` only supports hardcoded `react-ts`/`react-js`
  — no external template mechanism
- create-rspeedy source is only ~120 lines; forking vs writing from scratch
  is identical effort, and there's no git history to preserve (new repo)
- Direct `create-rstack` dependency is the cleanest approach

### Compatibility contract for future merge-back

To ensure `create-vue-lynx` templates can be absorbed into `create-rspeedy`
(or create-rspeedy gains external template support), maintain:

1. **Same directory layout**: `template-vue-ts/`, `template-vue-js/` with
   identical structure to `template-react-ts/` (lynx.config.ts, src/, etc.)
2. **Same `template-common/` pattern**: shared files across language variants
3. **Same package.json version placeholder convention**: `devDependencies`
   versions pulled from the CLI's own package.json `devDependencies`
4. **Same `create-rstack` API**: `create()`, `select()`, `checkCancel()`

If `create-rspeedy` later adds Vue support (bundled or external templates):

- Copy `template-vue-*` directories into create-rspeedy
- Add `{ template: 'vue', lang: 'ts' }` to TEMPLATES array
- Deprecate `create-vue-lynx` pointing to `create-rspeedy`

### What to include

Templates come from the existing `create-rspeedy/template-vue-*/` in
lynx-stack. Move them into the vue-lynx repo.

## Proposed Structure (vue-lynx repo)

```
vue-lynx/                          ← repo root
├─ packages/
│  └─ create-vue-lynx/             ← npm: create-vue-lynx
│     ├─ src/index.ts              (~120 lines, based on create-rstack)
│     ├─ template-common/
│     ├─ template-vue-ts/
│     └─ template-vue-js/
├─ runtime/                        ← vue-lynx (root export)
├─ plugin/                         ← vue-lynx/plugin
├─ main-thread/                    ← vue-lynx/main-thread (internal)
├─ internal/                       ← vue-lynx/ops (internal)
├─ testing-library/                ← vue-lynx/testing
├─ upstream-tests/                 ← not published
├─ package.json                    ← name: "vue-lynx", exports: { ... }
├─ tsconfig.json
└─ ...
```

### Source code management

- All `@lynx-js/*` dependencies use **npm version ranges** (not `workspace:*`)
- `create-rspeedy`'s Vue templates in lynx-stack can either:
  - Point to published `vue-lynx`, or
  - Be removed once `create-vue-lynx` is the canonical entry point

### CI management

**vue-lynx repo CI:**

- Build all subpath targets
- Unit tests (vue-lynx/testing pipeline)
- Upstream tests (upstream-tests: 800 pass / 141 skip / 0 fail)
- Publish `vue-lynx` + `create-vue-lynx` to npm on release

**lynx-stack CI (integration):**

- Consider an **ecosystem-ci** pattern (similar to vuejs/ecosystem-ci):
  before releasing breaking changes to `@lynx-js/types`,
  `template-webpack-plugin`, etc., trigger vue-lynx's test suite via
  `repository_dispatch` to catch regressions early

### What needs to happen in lynx-stack after extraction

1. Remove `packages/vue/` directory
2. Clean up `pnpm-workspace.yaml` (remove `packages/vue/*` entries)
3. Clean up root `tsconfig.json` (remove vue project references)
4. Clean up `biome.jsonc` / `eslint.config.js` (remove vue ignore entries)
5. PR the `ElementPAPI.ts` CSS custom property fix to `main` independently
6. Decide whether to keep `create-rspeedy` Vue templates (pointing to npm
   `vue-lynx`) or remove them in favor of `create-vue-lynx`

## Status

- [ ] PR the `ElementPAPI.ts` fix to lynx-stack main
- [ ] Resolve `@lynx-js/react` worklet-runtime coupling
- [ ] Extract repo with `git filter-repo`
- [ ] Consolidate `@lynx-js/vue-*` packages into single `vue-lynx` with subpath exports
- [ ] Create `create-vue-lynx` package (based on `create-rstack`)
- [ ] Set up independent CI (build + test + publish)
- [ ] Add ecosystem-ci integration to lynx-stack
