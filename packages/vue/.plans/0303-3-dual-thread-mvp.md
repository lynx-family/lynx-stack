# Vue 3 on Lynx — Dual-Thread MVP via ShadowElement Custom Renderer

## Context

我们分析了 vue-vine 的 `exp/vue-vine-lynx` 分支。它把 Vue 的完整 runtime（VDOM、reconciler、reactive）全部放在 Main Thread (Lepus) 上，Background Thread 几乎空转，仅做事件中转。这导致：

- 每个普通事件多一次跨线程 round-trip（Native → BG → 转发 → Main）
- Main Thread JS 负载过重
- BG bundle 携带完整 Vue runtime 但无用

本 plan 实现一个更合理的架构：**Vue 核心跑 BG Thread，Main Thread 只做 PAPI 执行**。

---

## Goals

1. **Vue runtime-core 跑在 Background Thread**：reactive、VDOM diff、component lifecycle、event handlers 全在 BG
2. **Main Thread 仅做 PAPI 操作执行**：接收扁平 operation 数组，逐条执行 `__CreateView`/`__AppendElement`/`__SetAttribute` 等
3. **事件无需跨线程转发**：Native 投递到 BG → handler 直接执行 → reactive update → 生成 ops → 发 Main
4. **Vue Block Tree 自动生效**：update 时只有 dynamic nodes 产生 ops，静态部分零流量
5. **纯 `createRenderer` scope 实现**：不修改 Vue runtime-core 源码，只通过 RendererOptions nodeOps 接口

## Non-Goals

1. **首屏优化 (Snapshot 机制)**：不做 Main Thread 独立渲染静态骨架。初次渲染需要等 BG 全量 ops。这需要编译器生成 PAPI 调用函数（类似 ReactLynx Snapshot.create），超出 MVP scope
2. **Worklet / 主线程事件**：`'main thread'` directive 函数提取、`main-thread:bindtap` 等高频事件优化暂不实现
3. **CSS 处理**：不处理 CSS scoping、CSS 继承等。属性中的 style 作为对象/字符串直接传递
4. **HMR / Dev Server**：不做热更新支持
5. **List 虚拟化**：Lynx `<list>` 组件的回调式渲染 (`componentAtIndex`) 暂不支持
6. **Vue Vine 模板语法**：先不集成 Vine 编译器，纯 `h()` render function + `defineComponent` 验证核心管线
7. **Template Ref 跨线程访问**：`ref` 拿到 ShadowElement，不支持直接调 PAPI

---

## Key Decisions & Principles

### D1: 渲染线程选择 — Vue 跑 BG，PAPI 在 Main

**原因**：Lynx Native 将事件投递到 BG Thread（`globalThis.publishEvent`），这是平台固有行为不可改变。如果 Vue 在 Main Thread，每个事件都要从 BG 转发到 Main，多一次跨线程开销。Vue 在 BG 时，事件到达后直接执行 handler，无需转发。

**代价**：初次渲染和每次更新的 ops 需要从 BG 发到 Main。但更新量受 Block Tree 优化控制，通常很小。

### D2: ShadowElement 作为 HostElement — nodeOps 双写

Vue 的 `createRenderer` 要求 `createElement` 同步返回节点引用，且 `parentNode()`/`nextSibling()` 必须同步返回。真实 Lynx 元素在 Main Thread，BG 无法同步访问。

**解法**：BG 维护一棵 ShadowElement 轻量链表树。每个 nodeOps 调用同时做两件事：

1. 同步更新 ShadowElement 树结构（满足 Vue 的同步查询需求）
2. 追加操作到 ops buffer（异步发给 Main Thread）

这与 ReactLynx 的 `BackgroundSnapshotInstance` 是完全相同的模式。

### D3: Ops 格式 — 扁平数组，ReactLynx 同款

```typescript
ops = [OP.CREATE, id, type, OP.INSERT, parentId, childId, anchorId, OP.SET_PROP, id, key, value, ...]
```

全是 number/string/简单值，天然可序列化。不使用 JSON 对象数组，避免额外 GC 压力。

### D4: 事件 handler 用 Sign 机制

函数不可序列化。`patchProp(el, 'onTap', null, handler)` 时：

- BG 侧：`sign = register(handler)` 存入 Map，发送 `[OP.SET_EVENT, el.id, eventName, sign]`
- Main 侧：`__AddEvent(element, 'bindEvent', eventName, sign)`
- 事件触发：Native → BG `publishEvent(sign, data)` → BG 查 Map → 直接执行 handler

Handler 始终在 BG Thread，不跨线程。

### D5: 跨线程传输 — 复用 `callLepusMethod`

ReactLynx 用 `lynx.getNativeApp().callLepusMethod(lifecycleConstant, {data: JSON.stringify(patchList)}, callback)` 从 BG 发 ops 到 Main Thread。我们复用相同机制，注册自己的 lifecycle constant。

### D6: Flush 时机 — 挂 Vue 的 `queuePostFlushCb`

所有 reactive 更新完成后再发 ops，确保一个 tick 只发一次。与 ReactLynx hook Preact 的 `options._commit` 同理。

### D7: Block Tree 自动生效

不需要任何额外实现。Vue 的 Block Tree 优化在 VNode diff 层决定"调不调 nodeOps"。静态节点复用 VNode 引用 → `oldVNode === newVNode` → 跳过 → 不调 nodeOps → 不产生 ops。我们的 ShadowElement 层完全透明。

---

## Architecture

```
Background Thread (JS Runtime)           Main Thread (Lepus)
┌────────────────────────────────┐      ┌─────────────────────────────┐
│  Vue 3 runtime-core            │      │  ops-apply.ts (~70 lines)   │
│  ┌──────────────────────────┐  │      │                             │
│  │ Reactive System          │  │      │  const elements = Map<id,   │
│  │ VDOM / Reconciler        │  │      │    LynxElement>             │
│  │ Component Lifecycle      │  │      │                             │
│  └──────────┬───────────────┘  │      │  switch(op) {               │
│             │ nodeOps calls    │      │    CREATE → __CreateView()  │
│  ┌──────────▼───────────────┐  │      │    INSERT → __AppendElement │
│  │ ShadowElement nodeOps    │  │      │    REMOVE → __RemoveElement │
│  │ ┌─────────┐ ┌──────────┐│  │      │    SET_PROP → __SetAttr     │
│  │ │ Shadow  │ │ ops      ││  │      │    SET_EVENT → __AddEvent   │
│  │ │ Tree    │ │ buffer   ││  │      │    SET_TEXT → __SetAttr     │
│  │ │ (sync)  │ │ (async)  ││  │      │  }                          │
│  │ └─────────┘ └────┬─────┘│  │      │  __FlushElementTree()       │
│  └──────────────────┼──────┘  │      │                             │
│                     │         │      └──────────▲──────────────────┘
│  Event Registry     │ flush   │                 │
│  Map<sign, handler> │         │                 │
│       ▲             │         │   callLepusMethod('vuePatchUpdate',
│       │ direct exec │         │     {data: ops}, callback)
│  publishEvent(sign) ▼         │                 │
│  (from Native)   ─────────────┼─────────────────┘
└────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create package `packages/vue/runtime` (BG Thread)

Vue custom renderer + ShadowElement + ops buffer + event registry.

**Files:**

#### `src/shadow-element.ts` (~80 lines)

双向链表节点，维护树结构供 Vue 同步查询。

```typescript
class ShadowElement {
  static nextId = 1;
  id: number;
  type: string;
  parent: ShadowElement | null = null;
  firstChild: ShadowElement | null = null;
  lastChild: ShadowElement | null = null;
  prev: ShadowElement | null = null;
  next: ShadowElement | null = null;

  insertBefore(child, anchor) {/* 链表操作 */}
  removeChild(child) {/* 链表操作 */}
}
```

#### `src/ops.ts` (~40 lines)

Operation 编码和 buffer 管理。

```typescript
export const OP = {
  CREATE: 0, // [0, id, type]
  CREATE_TEXT: 1, // [1, id, text]
  INSERT: 2, // [2, parentId, childId, anchorId (-1 = append)]
  REMOVE: 3, // [3, parentId, childId]
  SET_PROP: 4, // [4, id, key, value]
  SET_TEXT: 5, // [5, id, text]
  SET_EVENT: 6, // [6, id, eventType, eventName, sign]
  REMOVE_EVENT: 7, // [7, id, eventType, eventName]
  SET_STYLE: 8, // [8, id, styleKey, styleValue]
  SET_CLASS: 9, // [9, id, classString]
  SET_ID: 10, // [10, id, idString]
} as const;

let buffer: unknown[] = [];
export function pushOp(...args: unknown[]) {
  buffer.push(...args);
}
export function takeOps() {
  const b = buffer;
  buffer = [];
  return b;
}
```

#### `src/node-ops.ts` (~100 lines)

`RendererOptions` 实现。每个方法：更新 ShadowElement 树 + push ops。

- `createElement(type)` → `new ShadowElement(type)` + `pushOp(OP.CREATE, el.id, type)`
- `createText(text)` → `new ShadowElement('#text')` + `pushOp(OP.CREATE_TEXT, el.id, text)`
- `insert(child, parent, anchor)` → `parent.insertBefore(child, anchor)` + `pushOp(OP.INSERT, ...)`
- `remove(child)` → `parent.removeChild(child)` + `pushOp(OP.REMOVE, ...)`
- `parentNode(node)` → `return node.parent`（同步读影子树）
- `nextSibling(node)` → `return node.next`（同步读影子树）
- `patchProp(el, key, prev, next)` → 分类处理：
  - event (`/^on[A-Z]/`, `bind*`, `catch*`, `global-bind*`) → sign 注册 + `pushOp(OP.SET_EVENT, ...)`
  - `style` → `pushOp(OP.SET_STYLE, ...)` or 遍历 style object
  - `class` → `pushOp(OP.SET_CLASS, ...)`
  - `id` → `pushOp(OP.SET_ID, ...)`
  - 其他 → `pushOp(OP.SET_PROP, ...)`
- `setText(node, text)` → `pushOp(OP.SET_TEXT, node.id, text)`
- `setElementText(el, text)` → 清空子节点 + 创建文本节点（更新影子树 + push ops）

#### `src/event-registry.ts` (~50 lines)

Sign-based handler 注册和查找，纯 BG Thread 本地。

```typescript
const handlers = new Map<string, Function>()
export function register(handler) → sign
export function unregister(sign)
export function execute(sign, data)
export function publishEvent(sign, data) { execute(sign, data) }
```

#### `src/flush.ts` (~30 lines)

利用 Vue 的 `queuePostFlushCb` 在所有 reactive 更新后发送 ops。

```typescript
import { queuePostFlushCb } from '@vue/runtime-core';
let scheduled = false;
export function scheduleFlush() {
  if (scheduled) return;
  scheduled = true;
  queuePostFlushCb(() => {
    scheduled = false;
    const ops = takeOps();
    if (ops.length) {
      lynx.getNativeApp().callLepusMethod('vuePatchUpdate', {
        data: JSON.stringify(ops),
      });
    }
  });
}
```

#### `src/index.ts` (~20 lines)

创建 renderer，暴露 `createApp`。

```typescript
import { createRenderer } from '@vue/runtime-core';
const { createApp, render } = createRenderer(nodeOps);
export { createApp, render };
export * from '@vue/runtime-core';
```

#### `src/entry-background.ts` (~20 lines)

BG Thread 的 bootstrap 入口：

- 注入 `globalThis.publishEvent = publishEvent`（从 event-registry）
- 注入 `globalThis.renderPage` 等 Lynx 生命周期回调
- 在 `renderPage` 中触发 Vue 首次渲染 + flush

### Step 2: Create package `packages/vue/main-thread` (Main Thread)

纯 PAPI 执行器，不含 Vue。

**Files:**

#### `src/ops-apply.ts` (~80 lines)

接收 ops 数组，逐条执行 PAPI。

```typescript
const elements = new Map<number, LynxElement>();

export function applyOps(ops: unknown[]) {
  let i = 0;
  while (i < ops.length) {
    switch (ops[i++]) {
      case OP.CREATE: {/* __CreateView / __CreateText / ... */}
      case OP.INSERT: {/* __AppendElement / __InsertElementBefore */}
      case OP.REMOVE: {/* __RemoveElement */}
      case OP.SET_PROP: {/* __SetAttribute */}
      case OP.SET_EVENT: {/* __AddEvent */}
      case OP.SET_TEXT: {/* __SetAttribute(el, 'text', text) */}
      case OP.SET_STYLE: {/* __AddInlineStyle */}
      case OP.SET_CLASS: {/* __SetClasses */}
      case OP.SET_ID: {/* __SetID */}
    }
  }
  __FlushElementTree();
}
```

#### `src/entry-main.ts` (~15 lines)

Main Thread bootstrap：

- 注册 `globalThis.vuePatchUpdate = ({data}) => applyOps(JSON.parse(data))`
- 注册 `globalThis.renderPage` → `__CreatePage()` + 标记 ready

### Step 3: Create build plugin `packages/vue/rspeedy-plugin`

基于 ReactLynx 的 `plugin-react` 模式，简化版。

**Core logic:**

- 将每个 entry 拆分为 `{name}__main-thread` (layer: `vue:main-thread`) 和 `{name}` (layer: `vue:background`)
- Main thread entry imports: `packages/vue/main-thread/entry-main` + 用户代码
- Background entry imports: `packages/vue/runtime/entry-background` + 用户代码
- 注入 `__MAIN_THREAD__` / `__BACKGROUND__` 宏（通过 SWC optimizer globals）
- 配置 `RuntimeWrapperWebpackPlugin`（排除 main-thread.js）
- 配置 `LynxEncodePlugin` + `LynxTemplatePlugin`
- 配置 `DefinePlugin`（`__DEV__`, `__VUE_OPTIONS_API__` 等）

**可大量复用 `plugin-react/src/entry.ts` 的结构**，替换 React 特定的部分（`ReactWebpackPlugin` → 不需要，worklet → 不需要）。

### Step 4: Create demo app `packages/vue/e2e-lynx`

验证完整管线的 demo：

```typescript
// index.ts
import {
  createApp,
  ref,
  h,
  defineComponent,
} from '@anthropic-ai/vue-lynx-runtime';

const App = defineComponent({
  setup() {
    const count = ref(0);
    return () =>
      h('view', { style: { display: 'flex', flexDirection: 'column' } }, [
        h('text', null, `Count: ${count.value}`),
        h('view', {
          bindtap: () => {
            count.value++;
          },
        }, [
          h('text', null, 'Tap to increment'),
        ]),
      ]);
  },
});

const app = createApp(App);
app.mount();
```

### Step 5: Verify

1. **构建验证**：`rspeedy build` 产出 `.lynx.bundle`，包含 `main-thread.js` 和 `background.js`
2. **Bundle 内容验证**：
   - `background.js` 包含 Vue runtime-core + 用户组件 + ShadowElement
   - `main-thread.js` 仅包含 ops-apply (~80 行) + entry bootstrap
   - `__MAIN_THREAD__` / `__BACKGROUND__` 宏已正确替换
3. **运行验证**：在 Lynx 模拟器或真机上：
   - 静态渲染：`<text>` 显示文本
   - 响应式更新：`setInterval` 更新 ref → 文本变化
   - 事件处理：`bindtap` → count 递增 → 文本更新
4. **Ops 流量验证**：首次渲染后的更新，观察 ops 数组只包含变化的 `SET_TEXT` / `SET_PROP`，不包含静态节点的操作

---

## File Structure

```
packages/vue/
  runtime/                     # BG Thread — Vue custom renderer
    src/
      shadow-element.ts        # ShadowElement 双向链表
      ops.ts                   # Operation 编码 + buffer
      node-ops.ts              # RendererOptions 实现
      event-registry.ts        # Sign-based handler registry
      flush.ts                 # queuePostFlushCb → callLepusMethod
      index.ts                 # createApp, render exports
      entry-background.ts      # BG bootstrap
    package.json
    tsdown.config.ts

  main-thread/                 # Main Thread — PAPI executor
    src/
      ops-apply.ts             # Operation 执行器
      entry-main.ts            # Main Thread bootstrap
    package.json
    tsdown.config.ts

  rspeedy-plugin/              # Build plugin
    src/
      index.ts                 # Plugin entry
      entry.ts                 # Dual-bundle entry splitting
      constants.ts             # Layer names, plugin names
      define.ts                # __MAIN_THREAD__ / __BACKGROUND__ macros
    package.json
    tsdown.config.ts

  e2e-lynx/                    # Demo app
    src/
      index.ts                 # App entry
    lynx.config.ts
    package.json
    tsconfig.json
```

## Key References (existing code to follow/reuse)

| Pattern                                            | Reference File                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| Dual-bundle entry splitting                        | `packages/rspeedy/plugin-react/src/entry.ts`                       |
| `__MAIN_THREAD__`/`__BACKGROUND__` macro injection | `packages/webpack/react-webpack-plugin/src/loaders/options.ts`     |
| Operation enum + flat array format                 | `packages/react/runtime/src/lifecycle/patch/snapshotPatch.ts`      |
| BG→Main transmission via `callLepusMethod`         | `packages/react/runtime/src/lifecycle/patch/commit.ts` (L169)      |
| Main Thread ops apply loop                         | `packages/react/runtime/src/lifecycle/patch/snapshotPatchApply.ts` |
| BG shadow tree (BackgroundSnapshotInstance)        | `packages/react/runtime/src/backgroundSnapshot.ts`                 |
| Event sign lookup from BG                          | `packages/react/runtime/src/lynx/tt.ts` (L204-249)                 |
| PAPI type declarations                             | `.context/vue-vine/packages/runtime-lynx/src/shims.d.ts`           |

---

## 实现后总结

### 实际实现 vs 计划偏差

#### 1. Build 工具：tsdown → rslib

计划中用 `tsdown.config.ts` 打包 runtime/main-thread/rspeedy-plugin 三个包。实际使用 **rslib**（`@rslib/core`），与 monorepo 其他包保持一致。

关键配置：`bundle: false`——runtime 包不能打成单 bundle，因为多 entry point 共享 singleton state（ops buffer、event registry）。

#### 2. 立即挂载，不等 renderPage

计划中写 "在 `renderPage` 中触发 Vue 首次渲染"。实际发现 Lynx **不在 BG Thread 上调用 `renderPage`**——那是 Main Thread 的事。

**BG Thread 的生命周期**：`__init_card_bundle__(lynxCoreInject)` → AMD wrapper 执行 → entry-background.ts 初始化。此时 Main Thread 的 `renderPage` 已经跑完（page root id=1 已创建），所以 Vue 可以 **直接 `app.mount()`**，无需等待。

#### 3. 双重 bundle evaluation 问题

Lynx 对 `__init_card_bundle__` 调用两次（两次独立的 globalThis/lynxCoreInject）。BG 侧的 guard 无效（各自独立 scope），导致 ops 会发两份。

**解决**：MT 侧 `applyOps` 开头检测：如果第一个 CREATE op 的 id 已经在 elements Map 中，说明是重复 batch，直接 skip 整个 ops 数组。

#### 4. `ShadowElement.nextId` 从 2 开始

Page root element 在 MT 上始终是 id=1（由 `renderPage` 创建）。BG 侧 `ShadowElement.nextId` 从 2 开始，避免 id 冲突。

#### 5. entry-background.ts 需要设置双路径 publishEvent

事件回调需要同时设置 `lynxCoreInject.tt.publishEvent` **和** `globalThis.publishEvent`。Lynx 从 `lynxCoreInject.tt` 路径调用，但某些场景走 `globalThis`。`lynxCoreInject` 是 AMD closure 变量，不在 globalThis 上。

#### 6. `VueMainThreadPlugin` flat-bundle 方案

计划中假设 main-thread 代码直接通过 webpack entry 打包。实际遇到 **`chunkLoading: 'lynx'` 导致 module factory 不执行** 的问题（`StartupChunkDependenciesPlugin` 的 `hasChunkEntryDependentChunks(chunk)` 返回 false）。

**解决**：rslib 预编译 main-thread → `dist/main-thread-bundled.js`，`VueMainThreadPlugin` 在 `PROCESS_ASSETS_STAGE_ADDITIONAL` 阶段用 `fs.readFileSync` 读入并替换 webpack asset。

#### 7. Comment node → `__CreateRawText('')`

Vue 的 Fragment/v-if anchor 用 comment node。Lynx 没有 comment 元素类型，用 `__CreateRawText('')` 创建零大小文本节点作为不可见占位符。

### 已验证的 MVP 能力

| 能力                        | 状态 | 验证方式                                |
| --------------------------- | ---- | --------------------------------------- |
| 基础渲染（view/text/image） | ✅   | counter demo、todomvc                   |
| CSS inline styles           | ✅   | backgroundColor, padding, fontSize 等   |
| 响应式更新                  | ✅   | setInterval 自增 counter                |
| 事件（bindtap）             | ✅   | 物理点击触发 handler                    |
| CSS class + selector        | ✅   | gallery demo（enableCSSSelector: true） |
| v-if / v-for                | ✅   | todomvc                                 |
| `<list>` 虚拟列表           | ✅   | gallery waterfall list                  |
| MTS worklet 事件            | ✅   | mts-demo、swiper                        |
| MainThreadRef 元素绑定      | ✅   | mts-draggable、swiper                   |
| MainThreadRef 值状态        | ✅   | swiper（INIT_MT_REF fix）               |
| runOnMainThread             | ✅   | swiper indicator click                  |
