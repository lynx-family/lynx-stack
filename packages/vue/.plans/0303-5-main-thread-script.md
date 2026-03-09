# Vue Lynx Main Thread Script (MTS) Design Plan

## Scope

**This PR**: Design document + **Phase 1 runtime foundation** (new ops, patchProp detection, `MainThreadRef` composable, MT executor changes). No SWC build transform yet — Phase 1 tests with manually-constructed worklet context objects.

**Template syntax**: `:main-thread-bindscroll="onScroll"` (v-bind prefix, zero Vue compiler changes needed).

## Context

Vue Lynx currently routes ALL event handling through the Background Thread: native event → `publishEvent(sign, data)` on BG → Vue handler → reactive updates → ops buffer → `callLepusMethod` → Main Thread PAPI. This introduces 2 thread crossings per interaction, causing perceptible latency for gesture-driven animations and making `v-model` on `<input>` impossible (Lynx's `getValue()`/`setValue()` are synchronous, Main Thread-only APIs).

React Lynx solves this with **Main Thread Script**: functions marked with `'main thread'` directive execute synchronously on the Main Thread with zero thread crossings. We adapt this pattern for Vue, reusing Lynx's existing worklet infrastructure.

## Architecture Overview

```
BUILD TIME                                          RUNTIME
─────────────────────────────────────────────────────────────────────────────
.vue file                                           BG Thread
  │                                                 ┌─────────────────────┐
  ├─ <script setup>  → BG bundle (vue-loader)      │ Vue renderer        │
  │                                                 │ patchProp detects   │
  ├─ <script main-thread>  → MT bundle             │ "main-thread-bind*" │
  │  (compiled for Lepus, registered via            │ → pushOp(SET_WORK- │
  │   registerWorkletInternal)                      │   LET_EVENT, ctx)   │
  │                                                 │ → callLepusMethod  │
  └─ webpack bundles                                └────────┬────────────┘
     ├─ BG: Vue + user code (worklet context objs)           │
     └─ MT: PAPI executor + worklet-runtime                  ▼
           + registerWorkletInternal calls            MT Thread
                                                    ┌─────────────────────┐
                                                    │ applyOps receives   │
                                                    │ SET_WORKLET_EVENT   │
                                                    │ → __AddEvent(el,   │
                                                    │   type, name,       │
                                                    │   {type:'worklet',  │
                                                    │    value: ctx})     │
                                                    │                     │
                                                    │ User taps element:  │
                                                    │ → runWorklet(ctx,  │
                                                    │   [event]) — ZERO  │
                                                    │   thread crossings  │
                                                    └─────────────────────┘
```

## User-Facing API

### SFC Syntax: `<script main-thread>`

Main-thread functions live in a **separate `<script>` block** — Vue-idiomatic, clean separation:

```vue
<script setup>
import { ref } from 'vue';
import { useMainThreadRef } from '@lynx-js/vue-runtime';

const count = ref(0);
const elRef = useMainThreadRef(null);
</script>

<script main-thread>
// This entire block compiles for the Main Thread.
// Exports become worklet context objects available in the template.
export function onScroll(event) {
  event.currentTarget.setStyleProperty('opacity', '0.5');
}

export function onTap(event) {
  event.currentTarget.setStyleProperty('background-color', 'blue');
}
</script>

<template>
  <scroll-view
    :main-thread-ref="elRef"
    :main-thread-bindscroll="onScroll"
    :main-thread-bindtap="onTap"
    :style="{ width: 300, height: 300 }"
  >
    <text>Scroll me</text>
  </scroll-view>
</template>
```

**Why `<script main-thread>` instead of React's `'main thread'` directive?**

- Vue already supports multiple `<script>` blocks (`<script>` + `<script setup>`)
- Clean separation: BG logic in `<script setup>`, MT handlers in `<script main-thread>`
- No SWC closure extraction needed — the block boundary IS the thread separation
- vue-loader custom block handling can route the block to the MT bundle directly
- `event.currentTarget` provides element access; `useMainThreadRef` bridges shared state

### Template Binding Syntax (v-bind prefix)

```vue
<!-- Use :main-thread- prefix to bind worklet events/refs -->
<view :main-thread-bindtap="onTap" :main-thread-ref="elRef" />
```

Vue's `:` (v-bind) evaluates the expression and passes the JS value to `patchProp`. The `main-thread-` prefix is detected at runtime — zero Vue compiler changes needed.

### Cross-Thread References

**Option A: `useMainThreadRef` (explicit, general-purpose)**

```typescript
import { useMainThreadRef } from '@lynx-js/vue-runtime';

// Element reference
const elRef = useMainThreadRef<ViewElement>(null);
// <view :main-thread-ref="elRef" />

// In <script main-thread>:
elRef.value?.setStyleProperty('transform', '...'); // .value access (Vue convention)

// General MT state (not just elements)
const scrollY = useMainThreadRef(0);
// In <script main-thread>:
scrollY.value = event.detail.scrollTop; // writable on MT
```

**Option B: `useMainThreadHandle` (derived from template ref, future Phase 2)**

```typescript
import { useTemplateRef } from 'vue';
import { useMainThreadHandle } from '@lynx-js/vue-runtime';

const el = useTemplateRef<ShadowElement>('myEl');
const elHandle = useMainThreadHandle(el); // auto-derives from template ref
// <view ref="myEl" />  — standard Vue ref binding

// In <script main-thread>:
elHandle.value?.setStyleProperty('color', 'red');
```

Option A is Phase 1 (general-purpose). Option B layers on top later by resolving the ShadowElement id → PAPI element mapping on MT.

### Other Composable APIs (future)

```typescript
// runOnMainThread — async BG → MT invocation (future Phase 2)
const result = await runOnMainThread(fn)(arg1, arg2);

// runOnBackground — async MT → BG invocation (future Phase 2)
await runOnBackground(() => {
  count.value++;
})();
```

## Compile-Time Transform (Phase 2 — not this PR)

### Two approaches considered:

**A. `<script main-thread>` block** (Vue-idiomatic, recommended)

- vue-loader custom block handler routes the block to MT bundle
- Exports from the block are mapped to worklet context objects on BG side
- No SWC closure extraction needed

**B. `'main thread'` directive** (React Lynx compatible, fallback)

- Reuse `@lynx-js/swc-plugin-reactlynx` worklet visitor on vue-loader JS output
- `target: 'JS'` for BG (replaces fn with `{ _c, _wkltId }`), `target: 'LEPUS'` for MT (emits `registerWorkletInternal`)
- Callable via `transformReactLynxSync()` from `@lynx-js/react/transform` (napi binding)

### Build Pipeline Change (Phase 2)

**Current**: MT bundle = ONLY `entry-main.ts` (PAPI executor, no user code)

**New**: MT bundle = `entry-main.ts` + `worklet-runtime` + `<script main-thread>` blocks (or LEPUS-transformed user code)

## Runtime Changes

### New Op Codes (`packages/vue/runtime/src/ops.ts`)

```typescript
export const OP = {
  // ... existing 0-10 ...
  SET_WORKLET_EVENT: 11, // [11, id, eventType, eventName, workletCtx]
  SET_MT_REF: 12, // [12, id, { _wvid }]
} as const;
```

### patchProp Extension (`packages/vue/runtime/src/node-ops.ts`)

```typescript
// Detect main-thread-* props (added before existing event/style/class checks):
if (key.startsWith('main-thread-')) {
  const suffix = key.slice('main-thread-'.length);
  if (suffix === 'ref') {
    pushOp(OP.SET_MT_REF, el.id, (nextValue as MainThreadRef).toJSON());
  } else {
    const event = parseEventProp(suffix);
    if (event && nextValue) {
      pushOp(OP.SET_WORKLET_EVENT, el.id, event.type, event.name, nextValue);
    }
  }
  scheduleFlush();
  return;
}
```

### Main Thread Executor (`packages/vue/main-thread/src/ops-apply.ts`)

```typescript
case OP.SET_WORKLET_EVENT: {
  const id = ops[i++], eventType = ops[i++], eventName = ops[i++], ctx = ops[i++]
  const el = elements.get(id)
  if (el) __AddEvent(el, eventType, eventName, { type: 'worklet', value: ctx })
  break
}

case OP.SET_MT_REF: {
  const id = ops[i++], refImpl = ops[i++]
  const el = elements.get(id)
  // Store in worklet ref map if worklet-runtime is loaded
  if (el && typeof lynxWorkletImpl !== 'undefined') {
    lynxWorkletImpl._refImpl?.updateWorkletRef(refImpl, el)
  }
  break
}
```

### v-model Mechanism (Phase 3 — not this PR)

Pre-registered MT worklet handles synchronous input value sync:

```
User types → MT bindinput fires → MT worklet reads getValue()
  → MT: setValue() (immediate visual feedback, no flicker)
  → MT: dispatchEvent('Lynx.Vue.inputUpdate', { elementId, value }) to BG
  → BG: updates Vue ref(value) → reactive system → next tick
```

## Files to Create/Modify (Phase 1)

### New Files

| File                                          | Purpose                                                |
| --------------------------------------------- | ------------------------------------------------------ |
| `packages/vue/runtime/src/main-thread-ref.ts` | `MainThreadRef` class, `useMainThreadRef()` composable |
| `packages/vue/runtime/src/cross-thread.ts`    | `runOnMainThread()` stub, callback registry            |
| `packages/vue/e2e-lynx/src/mts-demo/index.ts` | Phase 1 E2E demo with hand-crafted worklet context     |

### Modified Files

| File                                        | Change                                                        |
| ------------------------------------------- | ------------------------------------------------------------- |
| `packages/vue/runtime/src/ops.ts`           | Add `SET_WORKLET_EVENT=11`, `SET_MT_REF=12`                   |
| `packages/vue/runtime/src/node-ops.ts`      | Detect `main-thread-*` props in `patchProp`                   |
| `packages/vue/runtime/src/index.ts`         | Export `useMainThreadRef`, `MainThreadRef`, `runOnMainThread` |
| `packages/vue/main-thread/src/ops-apply.ts` | Handle new op codes                                           |

### Reused from React Lynx (future phases, no modification)

| Package                          | What                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `@lynx-js/react/transform`       | SWC worklet transform (napi)                                                  |
| `@lynx-js/react/worklet-runtime` | `initWorklet()`, `registerWorkletInternal()`, `runWorklet()`, `Element` class |

## Implementation Steps (Phase 1)

### Step 1: New Op Codes

**File**: `packages/vue/runtime/src/ops.ts`

- Add `SET_WORKLET_EVENT = 11` and `SET_MT_REF = 12`

### Step 2: MainThreadRef Composable

**File (new)**: `packages/vue/runtime/src/main-thread-ref.ts`

- `MainThreadRef<T>` class: `_wvid`, `_initValue`, `toJSON()`, `.value` getter/setter (throws on BG in dev)
- Uses `.value` (Vue convention) instead of `.current` (React convention)
- `useMainThreadRef<T>(initValue)` with `onScopeDispose` cleanup
- Compatible with worklet-runtime's `_wvid`-based ref resolution on MT

### Step 3: patchProp Detection

**File**: `packages/vue/runtime/src/node-ops.ts`

- Detect `main-thread-*` prefix, parse suffix, emit `SET_WORKLET_EVENT` or `SET_MT_REF` ops

### Step 4: Main Thread Executor

**File**: `packages/vue/main-thread/src/ops-apply.ts`

- Handle `SET_WORKLET_EVENT`: `__AddEvent(el, type, name, { type: 'worklet', value: ctx })`
- Handle `SET_MT_REF`: store in worklet ref map (if available)

### Step 5: Cross-Thread Stubs

**File (new)**: `packages/vue/runtime/src/cross-thread.ts`

- `runOnMainThread(fn)` stub (logs warning that SWC transform needed)
- Callback registry scaffold for future async returns

### Step 6: Exports

**File**: `packages/vue/runtime/src/index.ts`

- Export new APIs

### Step 7: E2E Demo

**File (new)**: `packages/vue/e2e-lynx/src/mts-demo/`

- Hand-crafted worklet context object (simulates what compiler would produce)
- Tests the full ops plumbing: BG → ops → MT → `__AddEvent` with worklet context

## Testing Strategy (Phase 1)

Since Phase 1 has no SWC transform, we test the **runtime plumbing** only:

1. **Build check**: `pnpm build` in all three packages — existing counter/todomvc demos still work
2. **Type check**: `pnpm tsc --noEmit` passes across runtime, main-thread, rspeedy-plugin
3. **Ops flow test**: The mts-demo emits `SET_WORKLET_EVENT` ops. On MT, verify via `console.info` logs that `__AddEvent` is called with `{ type: 'worklet', value: { _wkltId: '...' } }`
4. **No regression**: Existing BG-thread events (`@tap`, `@confirm`) continue to work normally via sign-based registry
5. **DevTool verification**: `Runtime_listConsole` on LynxExplorer shows the worklet event binding logs

**Note**: The worklet handler won't actually fire yet (no worklet-runtime on MT). That requires Phase 2. Phase 1 proves the plumbing is correct.

---

## 实现后总结

### 实际实现 vs 计划偏差

#### 1. `<script main-thread>` 方案被放弃，改用 `'main thread'` directive

计划中推荐的 `<script main-thread>` 方案（Vue-idiomatic，单独 SFC block）**未被采用**。实际使用了 React Lynx 的 `'main thread'` 字符串 directive 方案，原因：

- **复用 SWC 编译器**：`@lynx-js/react/transform` 的 worklet 编译器（SWC NAPI binding）开箱即用，支持 `target: 'JS'`（BG 侧替换为 worklet context object）和 `target: 'LEPUS'`（MT 侧生成 `registerWorkletInternal()` 调用）
- **零 vue-loader 修改**：不需要为 custom block 增加新的 loader 配置
- **闭包自动捕获**：SWC 编译器自动分析 `'main thread'` 函数体的外部引用，序列化到 `_c`（closure values）中，包括 `MainThreadRef` 的 `_wvid` 标记
- **与 React Lynx 生态一致**：worklet-runtime、workletRefMap、runWorklet 等基础设施完全复用

**代价**：`'main thread'` 函数写在 `<script setup>` 中，不如独立 block 清晰。但实际使用发现这其实更灵活——可以在同一 scope 混合 BG 和 MT 代码，共享 props/computed/ref。

#### 2. `.current` 和 `.value` 双协议

计划中说 "Uses `.value` (Vue convention) instead of `.current` (React convention)"。实际实现后发现 **必须同时支持 `.current`**：

- worklet-runtime hydration 后的 ref 对象只有 `.current`（`{ current: value, _wvid: id }`）
- SWC 编译器生成的 LEPUS 代码中，worklet 函数体内的 ref 访问编译为 `.current`
- BG 侧 `MainThreadRef` class 上新增了 `.current` getter/setter（只读，dev 模式给警告）

#### 3. 发现并修复 value-only ref 注册缺失 (INIT_MT_REF)

**这是最大的意外发现**。计划中只提到 `SET_MT_REF`（元素绑定 ref），完全没预见到 value-only ref 的问题。

**问题**：`useMainThreadRef<number>(0)` 创建的 ref 没有绑定到任何 DOM 元素，因此不会触发 `SET_MT_REF` op。当 worklet 函数在 MT 运行时，hydration 过程通过 `_wvid` 查找 `_workletRefMap`，找不到条目 → 返回 `undefined` → `undefined.current = value` 报 TypeError。

**React Lynx 的做法**：

1. `useMainThreadRef(initValue)` 内部调用 `addWorkletRefInitValue(wvid, initValue)`，累积到 patch buffer
2. commit 阶段调用 `sendMTRefInitValueToMainThread()`，通过 `callLepusMethod('rLynxChangeRefInitValue', { data })` 发送到 MT
3. MT 侧 `updateWorkletRefInitValueChanges(patch)` 在 `_workletRefMap` 中创建 `{ current: initValue, _wvid }`

**Vue 的修复**（更简洁的方案）：

- 新增 `INIT_MT_REF = 13` op code
- `MainThreadRef` 构造函数中直接 `pushOp(OP.INIT_MT_REF, this._wvid, initValue)`
- ops 随初始渲染 batch 一起通过 `vuePatchUpdate` 发到 MT
- MT 侧 `applyOps` 中 `INIT_MT_REF` handler 在 `_workletRefMap` 创建条目

**优势**：利用已有 ops buffer 通道，无需新增 `callLepusMethod` 端点。INIT_MT_REF 在 CREATE/INSERT ops 之前入 buffer（因为 `useMainThreadRef` 在 setup 阶段调用），保证在任何 worklet 事件触发前就已注册。

#### 4. Build Pipeline：worklet-loader + VueMainThreadPlugin

计划中 Phase 2 留了两个编译方案，实际选择了 **`'main thread'` directive + SWC dual-pass** 方案：

```
webpack loader chain (BG bundle):
  vue-loader → worklet-loader → webpack

worklet-loader 做两次 SWC transform:
  Pass 1 (target: 'JS')    → 替换 'main thread' 函数为 worklet context objects
  Pass 2 (target: 'LEPUS') → 生成 registerWorkletInternal() 调用

extractRegistrations() 从 LEPUS 输出中提取 registerWorkletInternal(...) 调用
→ 通过 worklet-registry (globalThis shared Map) 传给 VueMainThreadPlugin
→ VueMainThreadPlugin 将注册代码注入到 main-thread-bundled.js 中
```

**VueMainThreadPlugin 的 flat-bundle 策略**：

- rslib 预编译 `entry-main.ts` → `dist/main-thread-bundled.js`（~17 kB，包含 ops-apply + worklet registrations）
- plugin 用 `fs.readFileSync` 读取该文件，替换 webpack 的 main-thread asset
- 标记 `'lynx:main-thread': true` asset info → `LynxTemplatePlugin` 路由到 Lepus 字节码
- 这解决了 `chunkLoading: 'lynx'` 导致的 `StartupChunkDependenciesPlugin` 不执行 module factory 的问题

#### 5. `runOnMainThread` 已实现，`runOnBackground` 未实现

- `runOnMainThread(fn)(args)` 通过 `lynx.getCoreContext().dispatchEvent({ type: 'Lynx.Worklet.runWorkletCtx', ... })` 实现
- `runOnBackground` 需要 MT→BG 回调通道，基础设施复杂，暂用 **BG 重复 touch 追踪** 作为 workaround（swiper indicator 同步用）

#### 6. Swiper Demo 验证了完整 MTS 能力

Swiper demo（3 个渐进式 entry）是 MTS 的"终极测试"：

| Entry          | MTS 功能覆盖                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `swiper-empty` | 无 MTS，纯静态布局                                                                                                            |
| `swiper-mts`   | ✅ MT touch handlers、✅ element ref (`setStyleProperty`)、✅ value-only ref (offset state)、✅ `requestAnimationFrame` on MT |
| `swiper`       | 上述全部 + ✅ `runOnMainThread`（indicator click → animate）、✅ BG+MT 双 touch handler 模式、✅ 嵌套 MT 函数调用             |

**关键技术模式**：

```vue
<!-- 同一元素同时绑定 MT 和 BG touch handlers -->
<view
  :main-thread-bindtouchstart="handleTouchStart"   <!-- MT: 零延迟拖拽 -->
  :main-thread-bindtouchmove="handleTouchMove"
  :main-thread-bindtouchend="handleTouchEnd"
  @touchstart="onBGTouchStart"                      <!-- BG: indicator 状态同步 -->
  @touchmove="onBGTouchMove"
  @touchend="onBGTouchEnd"
/>
```

#### 7. E2E Demo 命名与演进：`mts-demo/` → `mts-draggable-raw/` + `mts-draggable/`

计划 Step 7 中的 `mts-demo/` 在实际实现时命名为 **`mts-draggable-raw/`**——一个 scroll-view + draggable box 的对比 demo（MT smooth vs BG laggy），使用手工构建的 worklet context objects：

```typescript
// 手工 worklet context (Phase 1 — 无 SWC transform)
const onMTScrollCtx = {
  _wkltId: 'mts-draggable-raw:onScroll',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
};
onMTScrollCtx._c = { _mtRef: mtDraggableRef.toJSON() };
```

Phase 2 SWC transform 集成后，创建了 **`mts-draggable/`** 作为对照版本，使用 `'main thread'` directive：

```typescript
// Phase 2 — SWC 自动处理闭包捕获 + worklet 注册
const onMTScroll = (event: { detail?: { scrollTop?: number } }) => {
  'main thread'
  const el = (mtDraggableRef as ...).current
  el?.setStyleProperty('transform', `translate(...)`)
}
```

`mts-draggable-raw/` 保留作为 Phase 1 raw worklet 的参考实现，需配合 `dev-worklet-registrations.ts` 中手工的 `registerWorkletInternal()` 调用（现已清空，因所有 demo 迁移到 directive 方案）。

**Gallery 中的 raw worklet 迁移**：`GalleryComplete` 和 `GalleryScrollbarCompare` 最初也使用了 Phase 1 raw worklet context（`_wkltId`, `_workletType`, `_c`），后来迁移到 `'main thread'` directive。其余 Gallery（GalleryList、GalleryAutoScroll、GalleryScrollbar）不涉及 MTS，无需迁移。

### 遗留问题 & 后续计划

1. **`runOnBackground` 未实现**：需要 MT→BG 通信通道。React Lynx 通过 `Lynx.Worklet.runOnBackground` event 实现
2. **`<script main-thread>` SFC block**：仍可作为未来的语法糖，编译到 `'main thread'` directive
3. **首屏 MTS 优化**：当前 value-only ref 通过 ops buffer 在首次 flush 注册，首屏渲染前的 worklet 执行不受保护（实际上不会发生，因为首屏没有用户交互）
4. **worklet-runtime 错误边界**：MT 侧 worklet 函数报错时，错误信息只出现在 LynxExplorer toast（DevTool 看不到 Lepus 日志），调试体验差
