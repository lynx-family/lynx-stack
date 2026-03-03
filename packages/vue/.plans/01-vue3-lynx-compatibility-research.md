# Research Plan: Vue 3 × Lynx 兼容性调研

## 目标

摸清把 Vue 3 运行在 Lynx 上所需要的工作，重点从**测试基础设施**角度出发：

1. Vue 3 的 renderer 接口怎么和 Lynx BSI / Element PAPI 对接？
2. 现有的 `applyProp()`、LynxTestingEnv、preact-upstream-tests 模式，哪些可以直接复用？
3. 哪些是 semantic gap，需要新的 shim 或者不支持？

不产出可运行代码，产出一份**带明确结论的差距分析报告**。

---

## 前置背景（已知结论，不需要重复调研）

### Vue 3 RendererOptions 接口（已确认）

`createRenderer(options)` 需要实现 10 个必选方法 + 4 个可选方法：

```typescript
// 必选（10 个）
createElement(type, namespace?, isCustomizedBuiltIn?, vnodeProps?)
createText(text)
createComment(text)
setText(node, text)
setElementText(el, text)
insert(el, parent, anchor?)
remove(el)
parentNode(node): HostElement | null     // ← 需要 read-back
nextSibling(node): HostNode | null       // ← 需要 read-back
patchProp(el, key, prevValue, nextValue, namespace?, parentComponent?)

// 可选（4 个）
querySelector?(selector)                 // ← Teleport 用，BSI 不支持
setScopeId?(el, id)                      // Scoped CSS
cloneNode?(node)                         // Static hoist optimization
insertStaticContent?(content, ...)       // Static hoist optimization
```

### patchProp 的分发结构（已确认）

```
patchProp(el, key, prev, next)
├── key === 'class'  →  __SetClasses(el, next)
├── key === 'style'  →  __SetInlineStyles(el, next)        [需要处理 CSS 变量、vendor prefix]
├── isOn(key)        →  __AddEvent(el, ...)                [invoker 包装 pattern]
├── shouldSetAsProp  →  el[key] = next                     [IDL 属性，BSI 不支持]
└── else             →  __SetAttribute(el, key, next)
```

### 测试套件结构（已确认）

- `@vue/runtime-core/__tests__/` — 31 个测试文件，使用 mock renderer，**不依赖真实 DOM**
- `@vue/runtime-dom/__tests__/` — 10 个测试文件，patchClass/patchStyle/patchEvents 等，依赖真实 DOM

**runtime-core 测试**是最有价值的上游测试目标（类比 preact 的 `preact/test/`）。

---

## 调研任务

### Task 0: 拉取 Vue 3 代码

```bash
# 在 packages/vue-upstream-tests/ 或 .context/ 中
git clone --depth=1 https://github.com/vuejs/core vue-core
```

重点关注以下目录：

```
packages/runtime-core/src/
  renderer.ts          ← 完整的 renderer 实现（~2500 行）
  vnode.ts             ← VNode 结构
packages/runtime-dom/src/
  patchProp.ts         ← patchProp 入口
  nodeOps.ts           ← 参考 DOM nodeOps 实现
  modules/
    class.ts
    style.ts
    events.ts          ← invoker pattern 细节
    attrs.ts
packages/runtime-core/__tests__/
  renderer*.spec.ts    ← 直接看 renderer 测试
  apiWatch.spec.ts
  apiLifecycle.spec.ts
```

---

### Task 1: 确认 BSI 的 read-back 能力

**核心问题**：Vue 的 `parentNode(node)` 和 `nextSibling(node)` 在 patch phase 频繁调用。BSI 现在是 write-only（只 push patches），不支持这两个操作。

需要确认：

1. 读 `packages/react/runtime/src/snapshot/BackgroundSnapshotInstance.ts`（或相关文件）：
   - BSI 上有没有 `parentNode` / `nextSibling` 属性或方法？
   - BSI 有没有维护 in-memory 的父子关系（或者完全 write-only）？

2. 读 `packages/react/runtime/src/snapshot/SnapshotInstance.ts`：
   - SI 上 `parentNode` / `nextSibling` 是否通过 jsdom 节点支持？

**预期结论之一**：BSI 需要补充 in-memory 树结构（parent、nextSibling 指针），才能满足 Vue nodeOps 的要求。这是 VueLynx 和 ReactLynx 的主要架构差异之一。

---

### Task 2: 深读 events.ts 的 invoker pattern

Vue 的事件更新**不会** removeEventListener + addEventListener，而是替换 invoker 内部的 handler：

```typescript
// invoker 第一次创建时 addEventListener
// 之后更新只做：invoker.value = nextHandler
```

需要确认：

1. `__AddEvent(el, eventType, eventName, handler)` 的当前实现（`ElementPAPI.ts:209`）是否支持这种 update-without-re-register 语义？
2. Vue 的事件名是 camelCase `onClick` → Lynx 需要 `bind:tap` 或 `bindtap`？事件名转换规则是什么？
3. Vue 的事件修饰符 (`.stop`, `.prevent`, `.once`, `.capture`) 如何映射到 Lynx 事件系统？

**预期结论**：需要在 `patchProp` 的 event 分支实现类似 invoker 的包装层，不能直接 `__AddEvent`（因为 Vue 会频繁更新事件 handler，而 `__AddEvent` 每次都会创建新的 listener）。

---

### Task 3: 深读 style.ts 的 CSS 变量和 v-show 兼容性

`style.ts` 有几个特殊处理：

1. **CSS 变量**（`--xxx`）：用 `el.style.setProperty('--xxx', v)` 而不是普通赋值
2. **v-show 集成**：保存原始 display 值到 `el._vod`，在 hide/show 时恢复
3. **vendor prefix 自动检测**：`webkit`/`moz`/`ms`

需要确认：

1. Lynx 的 `__SetInlineStyles` 支持 CSS 变量吗？
2. `v-show` 需要读回 `el.style.display`——BSI 没有这个读能力，怎么处理？
3. 当前 `applyProp()` 对 style 的处理（`style:cssText`、`style:<prop>`）是否足够，还是需要扩展？

---

### Task 4: 理解 runtime-core 测试的 mock renderer 模式

**目标**：理解 `runtime-core/__tests__` 用的 mock renderer 长什么样，判断能否直接替换成 Lynx renderer。

读 `packages/runtime-core/__tests__/` 中几个代表性文件：

- `rendererElement.spec.ts` — 元素创建 / patch
- `rendererChildren.spec.ts` — children 更新（keyed, unkeyed, mixed）
- `apiWatch.spec.ts` — watcher 测试（不依赖 DOM）
- `apiLifecycle.spec.ts` — 生命周期测试（不依赖 DOM）

具体要回答：

1. mock renderer 提供了什么？是内置的 test-utils 还是每个测试文件自定义？
2. 测试里有多少断言是基于 DOM 读回（`innerHTML`, `querySelector`, `el.style`），多少是基于 VDOM 树？
3. 哪些测试文件完全不需要 DOM（只验证 lifecycle hooks、watcher 回调等）？
4. 估算：如果实现了完整 nodeOps，runtime-core 测试的初步 pass 率大约在多少？

---

### Task 5: Teleport 和 Suspense 的 querySelector 依赖

Vue 的 `Teleport` 组件需要 `querySelector`（用于找到 target container）。

需要确认：

1. `Teleport` 在 `renderer.ts` 中是独立 renderer 分支还是 inline 处理？
2. `querySelector` 是否只在 `Teleport` 中用到，还是其他地方也有？
3. Suspense 的异步处理是否需要任何特殊的 nodeOps 支持？

**预期结论**：Teleport 在 Lynx 上需要通过 `id`-based lookup 替代 CSS selector（类似 Lynx 自己的 ref 系统）。可以作为 skip_list 条目。

---

### Task 6: 和 Preact upstream tests 的类比分析

在以上调研完成后，对比 preact-upstream-tests 的架构，回答：

| 问题                                      | Preact 的解法                 | Vue 的情况                                         |
| ----------------------------------------- | ----------------------------- | -------------------------------------------------- |
| 如何替换 render()？                       | pipelineRenderPlugin 重写调用 | Vue 用 `app.mount(el)` — 需要不同的 intercept 方式 |
| Generic snapshot fallback？               | `snapshotManager.values` 拦截 | Vue nodeOps 没有 snapshot 概念，不需要             |
| BSI shim（style/event/removeAttribute）？ | `shimBSI()`                   | Vue 通过 nodeOps 隔离，理论上不需要 shim           |
| 主线程切换时机？                          | `options.__c` commit hook     | Vue 的调度器（`scheduler.ts`）flush 时机           |
| skiplist 结构是否复用？                   | ✅                            | ✅ 完全可以                                        |

---

## 产出格式

调研结束后，更新此文件，在每个 Task 下补充：

```
### 结论
- [已确认] xxx
- [需要新增] xxx
- [不支持/skip] xxx
- [gap 评估] 工作量：S/M/L
```

最终形成一个 **Gap Analysis 表**：

| 功能                                | Lynx 现有支持           | 需要新增                      | 复杂度 |
| ----------------------------------- | ----------------------- | ----------------------------- | ------ |
| createElement/insert/remove         | BSI patch ops           | 无                            | -      |
| parentNode / nextSibling            | ❌ BSI write-only       | BSI 需补 in-memory 树         | M      |
| patchProp: class / style / attrs    | `applyProp()` 已覆盖    | 无                            | -      |
| patchProp: events (invoker pattern) | `__AddEvent` 不支持更新 | invoker 包装层                | M      |
| querySelector (Teleport)            | ❌                      | skip_list                     | -      |
| v-show (style read-back)            | ❌                      | shim 或 skip                  | S      |
| cloneNode (static hoist)            | ❌                      | skip_list（可选优化，非必须） | -      |
| CSS 变量                            | 待确认                  | TBD                           | ?      |
| 事件名转换 onClick → bindtap        | ❌                      | 转换函数                      | S      |

---

## 执行顺序

1. **Task 0** — 拉代码（10 min）
2. **Task 1 + Task 2** — 并行（BSI read-back + invoker pattern）（30 min）
3. **Task 3 + Task 5** — 并行（style gaps + Teleport）（20 min）
4. **Task 4** — runtime-core 测试结构（20 min）
5. **Task 6** — 汇总对比（10 min）

总预计：约 90 分钟调研 → 产出 Gap Analysis 表。
