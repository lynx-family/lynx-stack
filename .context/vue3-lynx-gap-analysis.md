# Vue 3 × Lynx 兼容性差距分析报告

## 概览

本报告基于对 Vue 3 (`vuejs/core`) 源码与 Lynx BSI / Element PAPI 基础设施的深度对比分析，评估将 Vue 3 运行在 Lynx 上所需的工作量。

---

## Task 1: BSI 的 Read-Back 能力

### 结论

- **[已确认] BSI 已有完整的 `parentNode` 和 `nextSibling` 支持** — 原假设（BSI 是 write-only）是错误的
- **[不需要新增] 无需补充 in-memory 树结构**

### 具体发现

**BackgroundSnapshotInstance** (`packages/react/runtime/src/backgroundSnapshot.ts`):
- Line 63-67: 维护完整的双向树关系：`__parent`, `__firstChild`, `__lastChild`, `__previousSibling`, `__nextSibling`
- Line 81-87: 暴露 getter 方法 `parentNode` 和 `nextSibling`
- Line 227-238: `childNodes` getter 支持完整遍历
- Line 98-216: `appendChild`, `insertBefore`, `removeChild` 全部维护指针一致性

**SnapshotInstance** (`packages/react/runtime/src/snapshot.ts`):
- Line 462-474: 同样的树结构和 getter
- Line 291: 显式声明与 Preact 的 `ContainerNode` 接口兼容

**性能**: 所有树导航操作均为 O(1) 指针读取，适合 Vue patch 阶段的频繁调用。

**Vue 3 在 `renderer.ts` 中对 `parentNode`/`nextSibling` 的调用点**:
- Line 555: `hostNextSibling(n1.anchor!)` — Fragment anchor 定位
- Line 578/588: `hostNextSibling(el)` — unmount 后的 next 定位
- Line 982: `hostParentNode(oldVNode.el)` — component update 时的 container
- Line 1526: `hostParentNode(prevTree.el!)` — component re-render
- Line 2280/2364: `hostNextSibling(cur)` — move/teleport 操作

> **Gap 评估**: 无 gap。BSI 已完全满足 Vue 3 nodeOps 的 `parentNode` / `nextSibling` 需求。

---

## Task 2: Events Invoker Pattern vs `__AddEvent`

### 结论

- **[已确认] Lynx 的 `__AddEvent` 已经支持 update-without-re-register 语义** — 但实现机制不同
- **[需要新增] 事件名转换层**: Vue `onClick` → Lynx `tap`
- **[需要新增] 事件修饰符适配层**: `.stop`, `.prevent` 需要 runtime 包装
- **[不支持/skip]** `.once`, `.passive` 不在 Lynx `eventType` 体系中

### Vue 3 的 Invoker Pattern

文件: `runtime-dom/src/modules/events.ts`

```
patchEvent(el, rawName, prevValue, nextValue)
  ├── 已有 invoker 且 nextValue 存在 → invoker.value = nextValue  // 只更新闭包变量
  ├── 无 invoker 且 nextValue 存在   → 创建 invoker + addEventListener
  └── 已有 invoker 且 nextValue 为空 → removeEventListener
```

- 使用 `Symbol('_vei')` 在 DOM 元素上存储 invoker 映射
- 事件名解析: `onClick` → `click`, `onClickOnce` → `click` + `{ once: true }`
- 时间戳去重 (`e._vts`) 防止异步竞态

### Lynx 的 `__AddEvent` 机制

文件: `packages/web-platform/web-mainthread-apis/ts/createMainThreadGlobalThis.ts` (lines 285-383)

```typescript
type AddEventPAPI = (
  element: HTMLElement,
  eventType: 'bindEvent' | 'catchEvent' | 'capture-bind' | 'capture-catch',
  eventName: string,
  newEventHandler: string | { type: 'worklet'; value: unknown } | undefined,
) => void;
```

- **更新语义**: 通过 shared generic handler + `eventHandlerMap` lookup table 实现。DOM listener 固定不变，更新只改 map 内容
- **事件名映射** (`packages/web-platform/web-constants/src/eventName.ts`):
  - `tap` → `click`, `scroll` → `lynxscroll`
  - 按 tagName 做特殊映射 (e.g., `X-INPUT`: `blur` → `lynxblur`)

### 差距分析

| Vue 3 功能 | Lynx 支持 | 需要什么 |
|-----------|----------|---------|
| update-without-re-register | ✅ 已支持（不同机制） | 无 |
| 事件名 `onClick` → `click` | ❌ Lynx 用 `tap` | 转换函数 |
| `.once` 修饰符 | ❌ 不在 eventType 体系中 | runtime 包装或 skip |
| `.passive` 修饰符 | ❌ 不在 eventType 体系中 | runtime 包装或 skip |
| `.capture` 修饰符 | ✅ `capture-bind` / `capture-catch` | 映射 |
| `.stop` / `.prevent` | ❌ 无内置支持 | handler 包装层 |

> **Gap 评估**: 工作量 **M**。核心的 add/update/remove 语义已具备，但需要事件名转换 + 修饰符适配层。

---

## Task 3: Style / CSS 变量 / v-show 兼容性

### 结论

- **[已确认] `__SetInlineStyles` 和 `__AddInlineStyle` 可覆盖基础样式需求**
- **[需要新增] CSS 变量 `--xxx` 的显式检测和处理**
- **[需要新增] v-show 的 display 保存/恢复机制**
- **[不需要] vendor prefix 自动检测** — Lynx native 层处理

### Vue 3 Style 模块

文件: `runtime-dom/src/modules/style.ts`

三个特殊处理:
1. **CSS 变量** (line 86-88): `--xxx` 前缀检测 → `style.setProperty('--xxx', v)`
2. **v-show** (line 57-64): 使用 Symbol 属性 `vShowOriginalDisplay` / `vShowHidden` 保存/恢复 display
3. **Vendor prefix** (line 105-125): `Webkit`/`Moz`/`ms` 自动探测 + 缓存

### Lynx Style 处理

两个 API:
- `__AddInlineStyle(element, key, value)` — 单属性（key 可以是 number ID 或 string）
- `__SetInlineStyles(element, style)` — 批量（接受 string/object/null）

**编译器优化**: 已知属性 → `__AddInlineStyle(el, propertyId, value)`，未知属性回退 → `__SetInlineStyles(el, cssText)`

### 差距分析

| 功能 | Vue 3 | Lynx | Gap |
|------|-------|------|-----|
| Object style | `style.setProperty(k, v)` | `__AddInlineStyle(el, k, v)` | 可映射 |
| String style (cssText) | `el.style.cssText = v` | `__SetInlineStyles(el, v)` | 可映射 |
| CSS 变量 `--xxx` | 显式 `setProperty` | 直接传递给 native，未显式处理 | **需确认 native 支持** |
| v-show display 保存 | `el[vShowOriginalDisplay]` 读回 | ❌ BSI 无 style 读回 | **需要 shim** |
| v-show display 恢复 | `style.display = saved` | ❌ | **需要 shim** |
| Vendor prefix | runtime 探测 | native 处理 | 无 gap |
| `!important` | `setProperty(k, v, 'important')` | 待确认 | **需确认** |

> **Gap 评估**: 工作量 **S-M**。核心样式 API 可映射，但 v-show 需要 in-memory display 缓存，CSS 变量需确认 native 支持。

---

## Task 4: Runtime-Core 测试的 Mock Renderer 模式

### 结论

- **[已确认] runtime-core 使用统一的 `@vue/runtime-test` mock renderer** — 非 per-file 自定义
- **[已确认] 约 70-75% 测试可在完整 nodeOps 实现后通过**（忽略 hydration 则 80-85%）
- **[已确认] 约 12 个测试文件完全不依赖 DOM**

### Mock Renderer 架构

`@vue/runtime-test` 包提供:
- `nodeOps.ts` — 内存树结构 (`TestElement`, `TestText`, `TestComment`)
- `serialize.ts` — 树序列化（类似 `innerHTML`）
- `patchProp.ts` — 属性 patching
- `triggerEvent.ts` — 事件触发

**关键**: `TestElement` 维护 `parentNode`, `children`, `props`, `eventListeners` — 与 BSI 的结构高度类似。

### 测试分类

| 类别 | 文件数 | 预估 Pass 率 | 说明 |
|------|--------|-------------|------|
| 纯生命周期/回调 | 12 | **100%** | scheduler, errorHandling, h, vnode, apiInject 等 |
| VNode 结构 | 10 | **100%** | 不依赖真实渲染 |
| 元素/树检查 | 8 | **90-95%** | 需要 `.el`, `.parentNode`, `.children` |
| Serialize 依赖 | 20 | **80-85%** | 需要正确的树序列化 |
| Keyed/Unkeyed Diff | 3 | **75-80%** | 复杂 reconciliation |
| Hydration | 2 | **60-70%** | 需要 server/client 协调 |

### 完全不依赖 DOM 的测试文件（12个）

1. `h.spec.ts` — VNode 结构
2. `vnode.spec.ts` — VNode 创建/克隆
3. `scheduler.spec.ts` — Job 调度
4. `errorHandling.spec.ts` — 错误传播
5. `component.spec.ts` — 组件命名
6. `apiInject.spec.ts` — 依赖注入
7. `apiSetupHelpers.spec.ts` — Setup 辅助函数
8. `misc.spec.ts` — 实例 reactivity
9. `helpers/renderList.spec.ts`
10. `helpers/renderSlot.spec.ts`
11. `helpers/toHandlers.spec.ts`
12. `helpers/createSlots.spec.ts`

### 与 Lynx 的类比

可以用 Lynx BSI 替换 `@vue/runtime-test` 的 `nodeOps`:

```
runtime-test nodeOps    →  Lynx nodeOps
─────────────────────────────────────────
createElement(tag)      →  new BSI(tag) + __CreateElement
createText(text)        →  new BSI(null) + __CreateRawText
insert(child, parent)   →  bsi.insertBefore(child, anchor)
remove(child)           →  parent.removeChild(child)
parentNode(node)        →  bsi.parentNode
nextSibling(node)       →  bsi.nextSibling
serialize(node)         →  需要自定义实现
triggerEvent(el, evt)   →  需要自定义实现
```

> **Gap 评估**: 工作量 **M**。核心 nodeOps 有对应物，但需实现 serialize 和 triggerEvent 的 Lynx 版本。

---

## Task 5: Teleport / Suspense / Static Hoist

### 结论

- **[不支持/skip] Teleport 强依赖 `querySelector`** — BSI 不支持 CSS selector 查询
- **[已确认] Suspense 不需要特殊 nodeOps** — 只用标准的 `createElement`, `patch`, `unmount`
- **[不支持/skip] `insertStaticContent` 和 `cloneNode`** — 依赖 innerHTML 和 deep clone

### querySelector 使用点

| 位置 | 用途 | Lynx 适用性 |
|------|------|------------|
| `Teleport.ts` resolveTarget() | 查找 teleport 目标容器 | ❌ 需要替代方案 |
| `runtime-dom/index.ts` app.mount() | 解析挂载容器 | ✅ 可直接传 element |
| `apiCustomElement.ts` | `querySelectorAll` 查 slot | ❌ skip |
| `useCssVars.ts` | `querySelectorAll` 注入 CSS 变量 | ❌ skip |

### Teleport 架构

- `Teleport` 在 `renderer.ts:454` 作为独立分支处理: `(type as typeof TeleportImpl).process(...)`
- 有独立的 `process()`, `remove()`, `move()`, `hydrate()` 方法
- `resolveTarget()` (Teleport.ts:42-73) 使用 `querySelector` 查找目标

**替代方案**: 通过 `id`-based lookup 替代 CSS selector（类似 Lynx 的 ref 系统）

### Static Hoist 优化

- `insertStaticContent` (nodeOps.ts:99-138): 使用 `innerHTML` 解析静态 HTML + `cloneNode(true)` 缓存
- Vue renderer 在 `processStaticNode()` (renderer.ts:534-541) 中使用
- **非必须功能**: 只影响编译后的静态内容优化，运行时可以 fallback 到逐元素创建

> **Gap 评估**: Teleport → skip_list；Suspense → 无 gap；Static Hoist → skip_list（可选优化）。

---

## Task 6: 与 Preact Upstream Tests 的类比分析

### 对比表

| 维度 | Preact 的做法 | Vue 的情况 |
|------|-------------|----------|
| **如何替换 render()** | Vite plugin: `render(` → `__pipelineRender(` 正则替换 | Vue 用 `createRenderer(nodeOps)` → **直接注入自定义 nodeOps 即可，不需要 transform** |
| **Generic snapshot fallback** | Monkey-patch `snapshotManager.values.has/get` → `createGenericSnapshot(type)` | Vue nodeOps 完全隔离，**理论上不需要 snapshot 概念**。但如果跑 runtime-core 测试，可复用 `@vue/runtime-test` 的 mock |
| **BSI shim 需求** | No-compile 模式: style proxy, event stubs, removeAttribute shim; Compiled 模式: 仅 removeAttribute | Vue 通过 nodeOps + patchProp 隔离，**理论上不需要 shim**。patchProp 的 Lynx 实现直接调 Element PAPI |
| **主线程切换时机** | `options.__c` commit hook → IPC → `snapshotPatchApply()` | Vue 的 `scheduler.ts` flush 时机 → 需要 hook flush 完成事件来触发 IPC |
| **skiplist 结构** | 5 类: unsupported_features, skip_list, nocompile_skip_list, compiler_skip_list, permanent_skip_list | **完全可以复用相同结构** |

### 关键架构差异

1. **Vue 的 `createRenderer` API 天然支持自定义后端** — 不需要像 Preact 那样 hack render 函数。只需提供 Lynx nodeOps 和 patchProp 实现。

2. **Vue 不需要 snapshot 概念**（除非要做编译优化）— Vue 的 renderer 直接操作 nodeOps 返回的节点，不经过 snapshot 中间层。

3. **Vue 的调度器** (`scheduler.ts`) 使用 Promise microtask 队列 (`queueJob`, `queuePostFlushCb`)，而非 Preact 的同步 commit hook。IPC 时机需要绑定到 `flushPostFlushCbs` 完成后。

4. **测试基础设施更简单** — Vue 的 `@vue/runtime-test` 已经是一个完整的 mock renderer，可以直接作为参考实现。

---

## 最终 Gap Analysis 表

| 功能 | Lynx 现有支持 | 需要新增 | 复杂度 | 优先级 |
|------|-------------|---------|--------|--------|
| createElement / insert / remove | ✅ BSI patch ops | 无 | - | - |
| createText / createComment | ✅ `__CreateRawText` | 可能需要 Comment 类型支持 | S | P1 |
| parentNode / nextSibling | ✅ BSI getter (O(1)) | 无 | - | - |
| setText / setElementText | ✅ BSI 操作 | 映射层 | S | P1 |
| patchProp: class | ✅ `__SetClasses` | 映射层 | S | P1 |
| patchProp: style (object/string) | ✅ `__AddInlineStyle` / `__SetInlineStyles` | 映射层 | S | P1 |
| patchProp: attrs | ✅ `__SetAttribute` | 映射层 | S | P1 |
| patchProp: events (add/update/remove) | ✅ `__AddEvent` 支持更新 | 事件名转换函数 | M | P1 |
| 事件修饰符 (.stop/.prevent) | ❌ | handler 包装层 | M | P2 |
| 事件修饰符 (.once/.passive) | ❌ | runtime 包装或 skip | S | P3 |
| CSS 变量 `--xxx` | ❓ 待确认 native 支持 | 可能需要显式 `setProperty` 路径 | S | P2 |
| v-show (display 保存/恢复) | ❌ BSI 无 style 读回 | in-memory display 缓存 | S | P2 |
| querySelector (Teleport) | ❌ | skip_list（或 id-based lookup 替代） | - | P3 |
| cloneNode (static hoist) | ❌ | skip_list（可选优化，非必须） | - | P3 |
| insertStaticContent | ❌ | skip_list（可选优化，非必须） | - | P3 |
| setScopeId (Scoped CSS) | ✅ `__SetAttribute(el, id, '')` | 映射 | S | P2 |
| Vue scheduler → IPC 桥接 | ❌ | 需要 hook `flushPostFlushCbs` | M | P1 |
| serialize (测试用) | ❌ | 自定义实现（遍历 BSI 树） | S | P1 |
| triggerEvent (测试用) | ❌ | 自定义实现 | S | P1 |

### 工作量估算

| 阶段 | 内容 | 估算 |
|------|------|------|
| **Phase 1: 核心 nodeOps** | createElement, insert, remove, text, comment, parentNode, nextSibling, setText, setElementText | **S** — BSI 已有对应物，只需薄映射层 |
| **Phase 2: patchProp** | class, style, attrs, events 的 Lynx 版 patchProp | **M** — 需要处理事件名转换、样式格式差异 |
| **Phase 3: 调度器桥接** | Vue scheduler flush → IPC → main thread apply | **M** — 参考 Preact commit hook 模式 |
| **Phase 4: 测试基础设施** | serialize, triggerEvent, skiplist, vitest config | **S** — 参考 preact-upstream-tests 结构 |
| **Phase 5: 高级功能** | v-show shim, CSS 变量, 事件修饰符, Scoped CSS | **S-M** — 逐个功能点突破 |

### 关键结论

1. **BSI 已经比预期更完善** — `parentNode`/`nextSibling` 的读回能力消除了最大的架构障碍
2. **Vue 的 `createRenderer` API 是天然的扩展点** — 不需要像 Preact 那样 hack render 函数
3. **runtime-core 测试是最佳切入点** — 约 12 个文件完全不依赖 DOM，另外 20+ 个文件只需 mock renderer
4. **preact-upstream-tests 的 skiplist + vitest 基础设施可以直接复用**
5. **最大的新增工作是 patchProp 的 Lynx 实现和 scheduler 桥接**，而非底层 DOM 操作
