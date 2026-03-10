# Future Work: Extract vue-lynx into an Independent Repository

## Motivation

`packages/vue/` is self-contained enough to live in its own repo. Separating it
from lynx-stack would give the Vue Lynx effort its own release cadence, CI
pipeline, and contributor surface — while still integrating cleanly via npm.

## Feasibility Analysis

### Commit history

25 real commits on `research/vue-lynx` touch `packages/vue/`.
9 of those also touch files outside; all are **integration glue**, not feature code:

| External file                                 | Commits | Nature                                                    |
| --------------------------------------------- | ------- | --------------------------------------------------------- |
| `pnpm-lock.yaml`                              | 6       | Auto-generated; a standalone repo has its own             |
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

All 25 commits preserved with original messages, authors, and dates.

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

## Proposed Structure

### Source code management

- **vue-lynx repo**: monorepo with runtime / main-thread / rspeedy-plugin /
  internal / examples / testing-library / vue-upstream-tests
- All `@lynx-js/*` dependencies use **npm version ranges** (not `workspace:*`)
- `create-rspeedy`'s Vue templates stay in lynx-stack, depending on published
  `@lynx-js/vue-*` packages

### CI management

**vue-lynx repo CI:**

- Build all packages
- Unit tests (vue-testing-library pipeline)
- Upstream tests (vue-upstream-tests: 800 pass / 141 skip / 0 fail)
- Publish to npm on release

**lynx-stack CI (integration):**

- Add an integration test job that `npm install`s latest `@lynx-js/vue-*`
  packages and runs `create-rspeedy --template vue-ts` build verification
- Consider adopting an **ecosystem-ci** pattern (similar to vuejs/ecosystem-ci):
  before releasing breaking changes to `@lynx-js/types`,
  `template-webpack-plugin`, etc., trigger vue-lynx's test suite via
  `repository_dispatch` to catch regressions early

### What needs to happen in lynx-stack after extraction

1. Remove `packages/vue/` directory
2. Clean up `pnpm-workspace.yaml` (remove `packages/vue/*` entries)
3. Clean up root `tsconfig.json` (remove vue project references)
4. Clean up `biome.jsonc` / `eslint.config.js` (remove vue ignore entries)
5. PR the `ElementPAPI.ts` CSS custom property fix to `main` independently
6. Keep `create-rspeedy` Vue templates pointing to npm-published versions

## Alternative: git subtree

Instead of full separation, `git subtree` can embed vue-lynx back into
lynx-stack with bidirectional sync. This keeps a single-repo development
experience but adds merge complexity. **Not recommended** unless frequent
cross-repo changes are expected.

## Status

- [ ] PR the `ElementPAPI.ts` fix to lynx-stack main
- [ ] Resolve `@lynx-js/react` worklet-runtime coupling
- [ ] Extract repo with `git filter-repo`
- [ ] Set up independent CI (build + test + publish)
- [ ] Add ecosystem-ci integration to lynx-stack
- [ ] Update `create-rspeedy` Vue templates to use npm versions
