# Plan: Layer-Based Main Thread Architecture

## Context

**Problem**: Vue Lynx's current main-thread architecture has two fundamental limitations:

1. **All entries share the same MT bundle**: `VueMainThreadPlugin` reads ONE pre-built flat bundle (`main-thread-bundled.js`) via `fs.readFileSync`, appends ALL worklet registrations from a globalThis Map, and replaces ALL entries' `main-thread.js` assets with the same content. Multi-entry apps (e.g. gallery with 6 entries) get identical MT bundles containing registrations from all entries.

2. **globalThis Map hack**: `worklet-registry.ts` uses `globalThis.__vue_worklet_lepus_registrations__` as a shared channel between the BG worklet-loader (writer) and `VueMainThreadPlugin` (reader). This is fragile, breaks module isolation, and is the root cause of problem 1.

**Root cause**: The MT entry only imports bootstrap code (`@lynx-js/vue-main-thread`), not user code. Webpack has no knowledge of per-entry worklet dependencies, so all registrations get pooled.

**React Lynx's approach**: Both BG and MT layers import the SAME user code. webpack `issuerLayer` routes files to different loaders per layer (BG: `worklet.target: 'JS'`, MT: `worklet.target: 'LEPUS'`). webpack's dependency graph naturally scopes each entry to its own registrations.

**Target**: Adopt React's layer-based approach — both layers import user code, MT-specific loaders extract only worklet registrations, webpack handles per-entry isolation naturally.

## Architecture Overview

```
Current:                                    Target:

BG entry: [entry-bg, ...user-imports]       BG entry: [entry-bg, ...user-imports]  (unchanged)
MT entry: [entry-main]  ← bootstrap only    MT entry: [entry-main, ...user-imports] ← includes user code

BG: vue-loader + worklet-loader(JS+LEPUS)   BG: vue-loader + worklet-loader(JS only)
MT: VueMainThreadPlugin replaces asset      MT: sfc-script-extractor(.vue) + worklet-loader-mt(LEPUS)

Registrations: globalThis Map (shared)      Registrations: webpack modules (per-entry)
```

## Detailed Architecture Diagrams

### Old Vue Architecture (flat bundle replacement)

"Flat bundle" 是指 `@lynx-js/vue-main-thread` 通过 rslib 预编译成的一个自包含 JS 文件
(`main-thread-bundled.js`)。它把 `entry-main.ts` + `ops-apply.ts` + `element-registry.ts`
等所有主线程代码打包成一坨纯 JS——没有 webpack `__webpack_require__`，没有 module wrapper。
`VueMainThreadPlugin` 在 webpack 编译阶段用 `fs.readFileSync()` 读这个文件，拼接 worklet
注册代码后用 `new RawSource(combined)` 整体替换 webpack 生成的 `main-thread.js` 产物。
Webpack 自己的 MT 编译结果被直接丢弃。

```
rslib 预构建 (独立于 webpack):
  entry-main.ts ─── rslib bundle ──▶ main-thread-bundled.js
  ops-apply.ts  ───┘                 (自包含, ~5kB flat JS)
                                        │
                                        │ fs.readFileSync()
                                        ▼
┌─────────────────── webpack / rspack ───────────────────────────┐
│                                                                │
│  BG entry: [entry-bg, App.vue, ...]                            │
│    └─ worklet-loader (JS pass + LEPUS pass)                    │
│         │                                                      │
│         ├─ JS output ──▶ background.js (正常 BG bundle)         │
│         │                                                      │
│         └─ LEPUS output ──▶ globalThis.__vue_worklet_...       │
│                              (所有 entry 的注册混在一起)   共享 Map│
│                                                                │
│  MT entry: [entry-main]   ← 只有 bootstrap，无用户代码           │
│    └─ webpack 正常编译 ──▶ main-thread.js                       │
│         │                                                      │
│         └─ VueMainThreadPlugin:                                │
│              1. 读 flat bundle                                  │
│              2. 从 globalThis Map 取 ALL 注册                   │
│              3. 拼接，用 RawSource 替换 webpack 产物   ← 丢弃    │
│              4. 标记 'lynx:main-thread': true                   │
│                                                                │
│  问题:                                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │ entry-A 的 MT bundle == entry-B 的 MT bundle     │          │
│  │ (所有 entry 共享同一份 flat bundle + 全部注册)      │          │
│  └──────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

### New Vue Architecture (layer-based)

```
┌─────────────────── webpack / rspack ───────────────────────────┐
│                                                                │
│  BG entry: [entry-bg, App.vue, ...]  layer: vue:background     │
│    │                                                           │
│    ├─ vue-loader ──▶ template + style + script 正常编译          │
│    └─ worklet-loader (JS pass only, 不再做 LEPUS)               │
│         └─▶ background.js                                      │
│                                                                │
│  MT entry: [entry-main, App.vue, ...]  layer: vue:main-thread  │
│    │         ↑ 同样的用户代码                                     │
│    │                                                           │
│    ├─ .vue 文件:                                                │
│    │    vue-sfc-script-extractor (正则提取 <script>)             │
│    │    └─ worklet-loader-mt (LEPUS pass)                       │
│    │       └─ 有 'main thread' 指令? → registerWorkletInternal()│
│    │       └─ 没有?                  → '' (空模块)               │
│    │                                                           │
│    ├─ .js/.ts 文件:                                             │
│    │    worklet-loader-mt (同上逻辑)                             │
│    │                                                           │
│    ├─ bootstrap 包 (entry-main.ts, ops-apply.ts):               │
│    │    排除 MT loader → 原样通过，正常执行                       │
│    │                                                           │
│    └─▶ main-thread.js (webpack 正常编译, 有 module wrappers)     │
│                                                                │
│  VueMarkMainThreadPlugin:                                      │
│    1. 强制 RuntimeGlobals.startup (修复 chunkLoading: 'lynx')   │
│    2. 标记 'lynx:main-thread': true                             │
│                                                                │
│  优势:                                                          │
│  ┌──────────────────────────────────────────────────┐          │
│  │ entry-A 的 MT bundle 只含 entry-A 的 worklet 注册 │          │
│  │ entry-B 的 MT bundle 只含 entry-B 的 worklet 注册 │          │
│  │ webpack 依赖图自动隔离，无需 globalThis hack       │          │
│  └──────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

### React Lynx Architecture (参考)

```
┌─────────────────── webpack / rspack ───────────────────────────┐
│                                                                │
│  BG entry: [entry-bg, App.tsx, ...]  layer: react:background   │
│    │                                                           │
│    └─ worklet-loader (JS pass)                                 │
│       └─ 'main thread' 函数 → 替换为 context 对象               │
│          (函数体发送到 MT, BG 只保留 sign/调用接口)               │
│       └─▶ background.js (React runtime + vDOM diffing)         │
│                                                                │
│  MT entry: [snapshot-entry, App.tsx, ...]  layer: react:main-thread
│    │         ↑ 同样的用户代码                                     │
│    │                                                           │
│    ├─ SWC snapshot 编译:                                        │
│    │    JSX → 直接 PAPI 调用 (编译时生成)                         │
│    │    <view style={{color:'red'}}>                            │
│    │      → __CreateView(0,0); __SetInlineStyle(el,'color:red')│
│    │    整个组件树编译为命令式 PAPI 代码                            │
│    │                                                           │
│    ├─ worklet-loader (LEPUS pass)                               │
│    │    → registerWorkletInternal() 注册                         │
│    │                                                           │
│    └─▶ main-thread.js                                          │
│         包含: snapshot 代码 + worklet 注册                       │
│         MT 首屏由 snapshot 直接创建 (无需等 BG)                   │
│                                                                │
│  关键区别:                                                      │
│  ┌──────────────────────────────────────────────────┐          │
│  │ React MT = snapshot 编译 (JSX → PAPI) + worklets  │          │
│  │ Vue   MT = 只有 worklets (无 snapshot 编译)        │          │
│  │                                                   │          │
│  │ React 首屏: MT snapshot 直接渲染 → BG hydrate      │          │
│  │ Vue   首屏: MT 只建空 page → BG 渲染 → ops → MT 执行│          │
│  └──────────────────────────────────────────────────┘          │
└────────────────────────────────────────────────────────────────┘
```

## Critical Files

| File                                                                  | Action                                                       |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/vue/rspeedy-plugin/src/entry.ts`                            | Major refactor: entry splitting + remove VueMainThreadPlugin |
| `packages/vue/rspeedy-plugin/src/loaders/worklet-loader.ts`           | Simplify: remove LEPUS pass                                  |
| `packages/vue/rspeedy-plugin/src/loaders/worklet-loader-mt.ts`        | **New**: MT LEPUS-only loader                                |
| `packages/vue/rspeedy-plugin/src/loaders/vue-sfc-script-extractor.ts` | **New**: extract `<script>` from .vue for MT                 |
| `packages/vue/rspeedy-plugin/src/worklet-registry.ts`                 | **Delete**                                                   |
| `packages/vue/rspeedy-plugin/src/index.ts`                            | Update: allow .vue on MT via extractor                       |
| `packages/vue/main-thread/rslib.config.ts`                            | Remove flat-bundle build config                              |

## Implementation Steps

### Step 1: Create `worklet-loader-mt.ts`

New loader applied to `.js/.ts` files on the MT layer. Does LEPUS pass only:

```typescript
// packages/vue/rspeedy-plugin/src/loaders/worklet-loader-mt.ts
export default function workletLoaderMT(
  this: LoaderContext,
  source: string,
): string {
  if (
    !source.includes('\'main thread\'') && !source.includes('"main thread"')
  ) {
    return ''; // No worklets → empty module (tree-shaken away)
  }

  const lepusResult = transformReactLynxSync(source, {
    ...sharedOpts,
    worklet: { target: 'LEPUS', filename, runtimePkg: '@lynx-js/vue-runtime' },
  });

  // Return ONLY registerWorkletInternal(...) calls (extracted from LEPUS output)
  return extractRegistrations(lepusResult.code);
}
```

Key differences from BG `worklet-loader.ts`:

- Only LEPUS pass (no JS pass)
- Returns extracted registrations as module content (not stored in global Map)
- Files without `'main thread'` directives return empty string

### Step 2: Create `vue-sfc-script-extractor.ts`

New loader for `.vue` files on MT layer. Extracts only `<script>` content:

```typescript
// packages/vue/rspeedy-plugin/src/loaders/vue-sfc-script-extractor.ts
import { parse } from '@vue/compiler-sfc';

export default function vueSfcScriptExtractor(
  this: LoaderContext,
  source: string,
): string {
  const { descriptor } = parse(source, { pad: false });

  // Return script content — worklet-loader-mt processes it next
  if (descriptor.scriptSetup) return descriptor.scriptSetup.content;
  if (descriptor.script) return descriptor.script.content;
  return ''; // No script → empty module
}
```

This replaces vue-loader on the MT layer. No template compilation, no style processing — just the raw `<script>` content where `'main thread'` directives live.

`@vue/compiler-sfc` is already a transitive dependency via `@rsbuild/plugin-vue`.

### Step 3: Simplify `worklet-loader.ts` (BG layer)

Remove LEPUS pass and worklet-registry dependency:

```diff
- import { addLepusRegistration } from '../worklet-registry.js';

  export default function workletLoader(source: string): string {
    // Pass 1: JS target (unchanged)
    const jsResult = transformReactLynxSync(source, { worklet: { target: 'JS', ... } });

-   // Pass 2: LEPUS target — REMOVED
-   const lepusResult = transformReactLynxSync(source, { worklet: { target: 'LEPUS', ... } });
-   const registrations = extractRegistrations(lepusResult.code);
-   if (registrations) addLepusRegistration(resourcePath, registrations);

    return jsResult.code;
  }
```

`extractRegistrations()` moves to `worklet-loader-mt.ts` (or shared util).

### Step 4: Modify `entry.ts` — entry splitting

**MT entry now includes user imports:**

```diff
  chain
    .entry(mainThreadEntry)
    .add({
      layer: LAYERS.MAIN_THREAD,
-     import: [require.resolve('@lynx-js/vue-main-thread')],
+     import: [require.resolve('@lynx-js/vue-main-thread'), ...imports],
      filename: mainThreadName,
    })
```

**Remove `VueMainThreadPlugin` class entirely** (lines 90-147). No more flat-bundle replacement.

**Remove `clearLepusRegistrations`/`getAllLepusRegistrations` imports.**

**Keep `VueWorkletRuntimePlugin`** (unchanged — still needed to inject worklet-runtime Lepus chunk).

### Step 5: Add loader rules for MT layer

In `applyEntry()`, register MT-specific loaders:

```typescript
// Vue SFC on MT: extract script only (no template/style)
chain.module
  .rule('vue:mt-sfc')
  .issuerLayer(LAYERS.MAIN_THREAD)
  .test(/\.vue$/)
  .use('vue-sfc-script-extractor')
  .loader(path.resolve(_dirname, './loaders/vue-sfc-script-extractor'))
  .end();

// JS/TS on MT: LEPUS worklet transform
chain.module
  .rule('vue:worklet-mt')
  .issuerLayer(LAYERS.MAIN_THREAD)
  .test(/\.(?:[cm]?[jt]sx?)$/)
  .exclude.add(/node_modules/).end()
  .use('worklet-loader-mt')
  .loader(path.resolve(_dirname, './loaders/worklet-loader-mt'))
  .end();
```

Update `index.ts` to remove `.vue` constraint to BG-only (MT now has its own `.vue` processing via `vue-sfc-script-extractor`):

```diff
- if (chain.module.rules.has(CHAIN_ID.RULE.VUE)) {
-   chain.module.rule(CHAIN_ID.RULE.VUE).issuerLayer(LAYERS.BACKGROUND);
- }
+ // vue-loader still only runs on BG (template compilation, style processing).
+ // MT uses vue-sfc-script-extractor instead (Step 2).
+ if (chain.module.rules.has(CHAIN_ID.RULE.VUE)) {
+   chain.module.rule(CHAIN_ID.RULE.VUE).issuerLayer(LAYERS.BACKGROUND);
+ }
```

Actually vue-loader stays BG-only. The new `vue:mt-sfc` rule handles `.vue` on MT before vue-loader would match.

### Step 6: Fix `chunkLoading: 'lynx'` startup issue

**Problem**: rspeedy's `chunkLoading: 'lynx'` (via `StartupChunkDependenciesPlugin`) only generates startup code when `hasChunkEntryDependentChunks(chunk)` is true. For MT entries without async chunk dependencies, this is false — module factories never execute.

**Solution**: `VueMTStartupPlugin` — a webpack plugin that injects entry execution into MT bundles:

```typescript
class VueMTStartupPlugin {
  constructor(private readonly mainThreadFilenames: string[]) {}

  apply(compiler: WebpackCompiler): void {
    compiler.hooks.thisCompilation.tap('VueMTStartup', (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: 'VueMTStartup', stage: PROCESS_ASSETS_STAGE_ADDITIONS },
        () => {
          for (const filename of this.mainThreadFilenames) {
            const asset = compilation.getAsset(filename);
            if (!asset) continue;

            const originalSource = asset.source.source();
            // Append self-executing startup: find __webpack_require__ and
            // trigger entry module evaluation.
            // Alternative: use ConcatSource to append startup call.
            const startupCode = '\n// Vue MT startup\n'
              + 'var __webpack_exports__ = __webpack_require__(__webpack_require__.s);\n';

            compilation.updateAsset(
              filename,
              new compiler.webpack.sources.ConcatSource(
                asset.source,
                new compiler.webpack.sources.RawSource(startupCode),
              ),
              { ...asset.info, 'lynx:main-thread': true },
            );
          }
        },
      );
    });
  }
}
```

> **Investigation needed**: Verify that `__webpack_require__.s` (startup module ID) is available in the generated bundle. If not, use the `entrypoints` API to find the entry module ID for each MT chunk. This may require a different approach — e.g., tapping into `additionalTreeRuntimeRequirements` to force `RuntimeGlobals.startupEntrypoint`.

**Fallback**: If the startup injection approach proves fragile, keep `VueMainThreadPlugin`'s flat-bundle replacement for `entry-main.ts` only, while letting webpack handle the user-code modules normally. This hybrid approach fixes per-entry isolation while preserving the proven startup mechanism.

### Step 7: Delete `worklet-registry.ts`

```bash
rm packages/vue/rspeedy-plugin/src/worklet-registry.ts
```

Remove all references in `entry.ts` (`clearLepusRegistrations`, `getAllLepusRegistrations` imports).

### Step 8: Update `@lynx-js/vue-main-thread` build

Currently rslib builds `entry-main.ts` twice:

- Normal build → `dist/entry-main.js` (used by webpack as module)
- Flat bundle build → `dist/main-thread-bundled.js` (used by `VueMainThreadPlugin`)

**Remove the flat-bundle build** from `rslib.config.ts`. Only the normal module build is needed now (webpack imports it as a regular dependency).

Also remove `dist/dev-worklet-registrations.js` build — dev worklet registrations are no longer appended by the plugin. Gallery demos that still use hand-crafted registrations should be migrated to `'main thread'` directives (or import registrations as a dev-only module).

### Step 9: Handle `dev-worklet-registrations.ts`

Currently `VueMainThreadPlugin` appends `dev-worklet-registrations.js` in dev mode for gallery demos with hand-crafted worklet functions.

Options:

- **Preferred**: Migrate remaining demos to `'main thread'` directive (most already done)
- **Fallback**: Import as a dev-only side-effect module in each gallery entry that needs it

## Risks & Mitigations

| Risk                                                                                             | Mitigation                                                                                           |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `chunkLoading: 'lynx'` startup: `__webpack_require__.s` may not exist                            | Investigate webpack internals; fallback to hybrid approach (Step 6 fallback)                         |
| `vue-sfc-script-extractor` may miss edge cases (`<script>` with src attribute, multiple scripts) | Use `@vue/compiler-sfc` parse which handles all SFC variants; add tests                              |
| webpack module wrapping overhead in MT bundle                                                    | Acceptable — a few KB of runtime; Lepus bytecode compilation handles it                              |
| `@vue/compiler-sfc` version mismatch with vue-loader                                             | Use the same version already installed by `@rsbuild/plugin-vue`                                      |
| Watch mode: MT loader must re-run when user files change                                         | webpack's dependency tracking handles this naturally since user files are now in MT dependency graph |

## Verification

1. **Build**: `pnpm build` in `packages/vue/rspeedy-plugin`, `packages/vue/main-thread`, `packages/vue/runtime` — no errors
2. **Testing-library**: `pnpm test` in `packages/vue/testing-library` — all tests pass
3. **Vue upstream**: `pnpm test` in `packages/vue/vue-upstream-tests` — no regressions
4. **Multi-entry isolation**: Build gallery example, verify each entry's `main-thread.js` contains ONLY its own worklet registrations (not all entries')
5. **LynxExplorer**: gallery-autoscroll, mts-draggable — worklet events fire correctly
6. **Watch mode**: modify a worklet function in dev mode, verify hot rebuild picks up the change

---

## Post-Implementation Notes

### Implementation commit

`b7120bbb` — `refactor(vue): adopt layer-based main thread architecture`

### Bundle size impact (`examples/vue`, production build, single-entry counter app)

| Bundle             | Before             | After              | Delta               |
| ------------------ | ------------------ | ------------------ | ------------------- |
| `main.lynx.bundle` | 73,167 B (73.2 kB) | 73,812 B (73.8 kB) | **+645 B (+0.88%)** |
| `main.web.bundle`  | 71,189 B (71.2 kB) | 71,724 B (71.7 kB) | **+535 B (+0.75%)** |

单 entry 无 worklet 场景下略增 ~0.6 kB，来自 webpack 给 MT 层空模块加的 module wrapper 开销。

#### 为什么 benchmark 没体现出优势

`examples/vue` 是单 entry 的 counter app，没有任何 `'main thread'` 指令。

在这个场景下：

- **旧架构**: 1 个 flat bundle（entry-main.ts 预编译）+ 0 条 worklet 注册
- **新架构**: webpack 编译 entry-main.ts + 用户代码（全部被 worklet-loader-mt 清空为 `''`）+ webpack module wrappers

多出的 645B 纯粹是 webpack 给这些空模块加的 wrapper 开销。没有任何 worklet 可以"拆开"，所以看不到收益。

#### 真正的收益场景是多 entry

假设 gallery 有 6 个 entry，其中 3 个有 worklet 事件：

```
旧架构 (flat bundle + globalThis Map):
┌─────────────────────────────────────────────┐
│ entry-A 的 MT bundle = flat bundle          │
│   + entry-A 的 worklet 注册                  │
│   + entry-B 的 worklet 注册  ← 不需要的       │
│   + entry-C 的 worklet 注册  ← 不需要的       │
├─────────────────────────────────────────────┤
│ entry-B 的 MT bundle = 完全一样的内容         │
├─────────────────────────────────────────────┤
│ entry-C 的 MT bundle = 完全一样的内容         │
├─────────────────────────────────────────────┤
│ entry-D/E/F 的 MT bundle = 还是一样的        │
│   (不需要任何 worklet 注册，但也全部包含了)     │
└─────────────────────────────────────────────┘
6 个 entry × 同一份 (bootstrap + 全部注册)

新架构 (layer-based):
┌───────────────────────────────┐
│ entry-A 的 MT bundle:         │
│   bootstrap + A 的注册 only    │
├───────────────────────────────┤
│ entry-B 的 MT bundle:         │
│   bootstrap + B 的注册 only    │
├───────────────────────────────┤
│ entry-D 的 MT bundle:         │
│   bootstrap + 空 (无注册)      │
└───────────────────────────────┘
每个 entry 只含自己的 worklet
```

所以：

- **单 entry 无 worklet**（当前 benchmark）：略增 ~0.6kB（webpack wrapper 开销）
- **多 entry 有 worklet**（gallery 场景）：每个 entry 的 MT bundle 更小，因为不再包含其他 entry 的注册代码

要准确验证收益，需要等 gallery 拆成多 entry 后再 benchmark。

### Deviations from plan

1. **Step 2 — `vue-sfc-script-extractor`**: Plan specified `@vue/compiler-sfc` for SFC parsing. In practice, `@vue/compiler-sfc` is NOT directly installed (only a transitive dep inside `@rsbuild/plugin-vue`'s closure). Used regex `/<script[^>]*>([\s\S]*?)<\/script>/g` instead — sufficient for extracting `<script>` content for worklet directive detection.

2. **Step 3 — `worklet-utils.ts`**: `extractRegistrations()` was moved to a shared `worklet-utils.ts` rather than kept inside `worklet-loader-mt.ts`, since both the old BG loader and the new MT loader may need it.

3. **Step 6 — Startup code fix**: Plan proposed injecting startup code via `processAssets` (appending `__webpack_require__(__webpack_require__.s)`). Actual solution was simpler — tapping `additionalTreeRuntimeRequirements` to add `RuntimeGlobals.startup` for MT entry chunks, which causes webpack to generate its own startup code naturally. No manual source manipulation needed.

4. **CSS extraction**: CSS handling was extracted from `entry.ts` into a dedicated `css.ts` module (`applyCSS()`) in the same commit. This was not part of the original plan but was a natural refactoring during the entry.ts rewrite.

### Pitfalls encountered

#### Pitfall 1: `chunkLoading: 'lynx'` prevents MT entry startup (predicted by Step 6)

**Symptom**: `processData is not a function`, `renderPage is not a function`, `vuePatchUpdate is not a function`.

**Root cause**: rspeedy sets `chunkLoading: 'lynx'` globally. Lynx's `StartupChunkDependenciesPlugin` only adds `RuntimeGlobals.startup` when `hasChunkEntryDependentChunks(chunk)` is true. For MT entries without async chunk dependencies, this is false — webpack never generates the `__webpack_require__(entryModuleId)` startup call, so module factories (including `entry-main.ts` which sets `globalThis.renderPage` etc.) never execute.

**Fix**: `VueMarkMainThreadPlugin` taps `additionalTreeRuntimeRequirements` and adds `RuntimeGlobals.startup` for any chunk whose entry layer is `LAYERS.MAIN_THREAD`.

#### Pitfall 2: pnpm workspace symlinks bypass `/node_modules/` excludes (NOT predicted)

**Symptom**: Same "processData is not a function" error persisted after Pitfall 1 fix.

**Root cause**: Reading the built `main-thread.js` revealed that the `RuntimeGlobals.startup` fix worked (startup code was generated), but **module factories were EMPTY** — both `entry-main.js` and `ops-apply.ts` had empty function bodies `function() {}`.

The `vue:worklet-mt` loader rule had `.exclude.add(/node_modules/)` to skip bootstrap packages. But in a pnpm workspace, `@lynx-js/vue-main-thread` resolves via symlink to `../../packages/vue/main-thread/dist/entry-main.js` (a real path under `packages/vue/`), NOT under `node_modules/`. So the exclude didn't catch it, and `worklet-loader-mt` returned `''` for these files (no `'main thread'` directive found).

Similarly, `@lynx-js/vue-internal` (the OP enum imported by `ops-apply.ts`) resolves to `packages/vue/shared/src/ops.ts`.

**Fix**: Explicitly resolve and exclude bootstrap package directories:

```typescript
const mainThreadPkgDir = path.dirname(
  require.resolve('@lynx-js/vue-main-thread/package.json'),
);
let vueInternalPkgDir: string | undefined;
try {
  vueInternalPkgDir = path.dirname(
    require.resolve('@lynx-js/vue-internal/package.json'),
  );
} catch { /* optional */ }

chain.module.rule('vue:worklet-mt')
  .exclude.add(/node_modules/)
  .add(mainThreadPkgDir);
if (vueInternalPkgDir) workletMtExclude.add(vueInternalPkgDir);
```

### Verification results

- **Build**: rspeedy-plugin + main-thread builds succeed
- **Testing-library**: 63/63 tests pass (7 test files)
- **Bundle verification**: `renderPage`, `processData`, `vuePatchUpdate` all present in encoded `.lynx.bundle`
- **LynxExplorer**: mts-draggable verified (hash match: BG `9177:69c82:1` = MT `9177:69c82:1`, zero runtime errors)
- **Multi-entry gallery**: gallery-scrollbar-compare and gallery-complete verified — all hashes match, worklet events fire correctly

### Pitfall 3: Stale webpack cache after plugin rebuild (NOT predicted)

**Symptom**: After fixing Pitfall 1 & 2 and verifying mts-draggable works, gallery-scrollbar-compare still showed `TypeError: cannot read property 'bind' of undefined` from `worklet-runtime/main-thread.js`.

**Root cause**: The gallery example's webpack persistent cache (`node_modules/.cache`) was still serving MT bundles built BEFORE the rspeedy-plugin fix. The dev server was not restarted after the plugin rebuild.

**Fix**: `rm -rf node_modules/.cache` + restart dev server. Error disappeared — hashes matched in both dev and prod builds.

**Lesson**: When debugging Lynx bundle errors, **always clear caches and restart the dev server first** before doing code analysis. rspeedy-plugin is built separately from example apps; after rebuilding the plugin, the downstream webpack cache is stale. This is documented in `packages/vue/AGENTS.md`.
