# ops-apply.ts 拆分重构

> **Initiative type**: Better Engineering — manual code review findings
> **Origin**: `todo.md` §ops-apply.ts + §Source code vise（已在 todo.md 标记 → 本 plan）

## 背景

### 问题 1：`ops-apply.ts` 职责混杂

`packages/vue/main-thread/src/ops-apply.ts` 目前 494 行，混合了三类不相关的职责：

| 类型                          | 行数    | 特征                                                     |
| ----------------------------- | ------- | -------------------------------------------------------- |
| 核心 DOM ops（11 个 op code） | ~130 行 | 独立，每个 case 5–9 行                                   |
| List 逻辑                     | ~180 行 | 侵入 CREATE / INSERT / SET_PROP 三个 case + 后置刷新循环 |
| MTS/Worklet 逻辑              | ~110 行 | 独立的 SET_WORKLET_EVENT / SET_MT_REF / INIT_MT_REF      |

### 问题 2：OP 协议定义重复（单源失真）

`runtime/src/ops.ts` 和 `main-thread/src/ops-apply.ts` 各自定义了 `const OP = { ... }`。
后者第 15 行注释写明 **"mirrored from runtime/ops.ts – must stay in sync"**——这是明显的代码坏味道：

- 新增 op code 要改两个文件
- 改错或漏改会静默失败（wrong integer → wrong behavior，无编译报错）

`OP` 常量是 BG Thread 和 Main Thread 之间的**线协议（wire protocol）**，不属于任何一侧，
应该有唯一的定义来源。

---

随着 list 和 worklet 功能继续迭代，继续堆在同一文件会导致：

- 维护难度线性增长
- 单元测试无法针对各类逻辑独立 mock 状态
- 代码审查时关注点混乱

## 性能前提：分拆不影响 Lepus 运行时性能

**关键事实**：`main-thread-bundled.js` 由 rslib 打成不含模块包装的 flat ESM。
Lepus 引擎在运行时看到的是单一编译单元，模块边界在打包后消失。JIT 完全可以跨原始文件内联函数，与函数写在同一文件无异。

另外，主线程的真实 bottleneck 是 PAPI（FFI 调用约 50–500 μs），函数调用开销约 2–20 ns，比例 < 0.04%，可以忽略。

**函数提取约束**：使用模块顶层的具名函数声明（`function foo()` 而非 `const foo = () =>`），这是 V8/JSC Turbofan/DFG 最容易内联的形式。

## 目标文件结构

```
packages/vue/
├── shared/                        (NEW 包) @lynx-js/vue-internal
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── ops.ts                 仅 OP const + 格式文档注释（无 pushOp/takeOps）
│
├── runtime/src/
│   └── ops.ts                     OP 改为 re-export from shared；保留 pushOp / takeOps
│
└── main-thread/src/
    ├── entry-main.ts              (改动：import elements 来源变更)
    ├── element-registry.ts        (NEW)  仅 elements Map
    ├── ops-apply.ts               (精简) ~150 行，纯 switch 循环；OP 来自 shared
    ├── list-apply.ts              (NEW)  ~200 行，list 全部状态和函数
    └── worklet-apply.ts           (NEW)  ~120 行，worklet 全部状态和函数
```

---

## Step 0：新建 `packages/vue/shared/` —— OP 协议包

### 为什么不从 `runtime` 直接导出 `OP`

`runtime/src/ops.ts` 包含三样东西：`OP`（协议）、`pushOp`（BG buffer 写）、`takeOps`（BG buffer 读）。
让 `main-thread` import `@lynx-js/vue-runtime` 意味着 executor 依赖 renderer——架构语义错误，
两者应该是对等的协议实现方，不应有互相依赖。

### 新包：`@lynx-js/vue-internal`

极简 workspace 包，仅放双方共享的线协议定义：

```ts
// packages/vue/shared/src/ops.ts
/**
 * Flat-array operation codes — the wire protocol between BG Thread and Main Thread.
 *
 * Format:
 *   CREATE:            [0, id, type]
 *   CREATE_TEXT:       [1, id]
 *   INSERT:            [2, parentId, childId, anchorId]   anchorId=-1 means append
 *   REMOVE:            [3, parentId, childId]
 *   SET_PROP:          [4, id, key, value]
 *   SET_TEXT:          [5, id, text]
 *   SET_EVENT:         [6, id, eventType, eventName, sign]
 *   REMOVE_EVENT:      [7, id, eventType, eventName]
 *   SET_STYLE:         [8, id, styleObject]
 *   SET_CLASS:         [9, id, classString]
 *   SET_ID:            [10, id, idString]
 *   SET_WORKLET_EVENT: [11, id, eventType, eventName, workletCtx]
 *   SET_MT_REF:        [12, id, refImpl]
 *   INIT_MT_REF:       [13, wvid, initValue]
 */
export const OP = {
  CREATE: 0,
  CREATE_TEXT: 1,
  INSERT: 2,
  REMOVE: 3,
  SET_PROP: 4,
  SET_TEXT: 5,
  SET_EVENT: 6,
  REMOVE_EVENT: 7,
  SET_STYLE: 8,
  SET_CLASS: 9,
  SET_ID: 10,
  SET_WORKLET_EVENT: 11,
  SET_MT_REF: 12,
  INIT_MT_REF: 13,
} as const;

export type OpCode = typeof OP[keyof typeof OP];
```

`package.json`：`"private": true`（仅 monorepo 内部使用，不发布）。

### 各包调整

**`runtime/src/ops.ts`**：

```diff
- export const OP = { CREATE: 0, ... } as const
+ export { OP } from '@lynx-js/vue-internal/ops'

  export function pushOp(...args: unknown[]): void { ... }
  export function takeOps(): unknown[] { ... }
```

**`main-thread/src/ops-apply.ts`**：

```diff
- // Op codes (mirrored from runtime/ops.ts – must stay in sync)
- const OP = { CREATE: 0, ... } as const
+ import { OP } from '@lynx-js/vue-internal/ops'
```

**`main-thread/rslib.config.ts`**：`@lynx-js/vue-internal` **不加入 externals**，让 rslib 把 14 个整数常量直接内联到 `main-thread-bundled.js`。运行时无跨包依赖，仅编译期 single source of truth。

---

## Step 1：新建 `element-registry.ts`

`elements` Map 目前在 `ops-apply.ts` 中定义，但被 `entry-main.ts`（seed page root）、
list 逻辑、worklet 逻辑同时访问。独立后避免循环依赖。

```ts
// element-registry.ts
/** Map from BG-thread ShadowElement id → Lynx Main Thread element handle */
export const elements = new Map<number, LynxElement>();
```

---

## Step 2：新建 `list-apply.ts`

将以下内容从 `ops-apply.ts` 迁移：

**状态**（全部模块顶层）：

- `listElementIds: Set<number>`
- `listItems: Map<number, ListItemEntry[]>`
- `itemKeyMap: Map<number, string>`
- `listItemPlatformInfo: Map<number, Record<string, unknown>>`
- `listItemsReported: Map<number, number>`
- `PLATFORM_INFO_ATTRS: Set<string>`
- `enqueueComponentNoop()`
- `createListCallbacks()` 内部函数

**对外导出**（供 `ops-apply.ts` 的 switch case 调用）：

```ts
// 查询
export function isListParent(parentId: number): boolean;
export function isPlatformInfoAttr(key: string): boolean;

// CREATE case 调用
export function createListElement(id: number): LynxElement;
// 内部：setup 6 个 state 结构 + __CreateList + __SetCSSId

// INSERT case 调用
export function insertListItem(
  parentId: number,
  child: LynxElement,
  childId: number,
): void;
// 内部：listItems.get(parentId)?.push(...)

// SET_PROP case 调用
export function setPlatformInfoProp(
  id: number,
  key: string,
  value: unknown,
): void;
// 内部：写 listItemPlatformInfo，itemKey 单独写 itemKeyMap

// applyOps 末尾调用（原 lines 449–476）
export function flushListUpdates(): void;
// 内部：遍历 listItems，构造 insertAction，__SetAttribute update-list-info

// 测试用
export function resetListState(): void;
```

---

## Step 3：新建 `worklet-apply.ts`

将 `SET_WORKLET_EVENT` / `SET_MT_REF` / `INIT_MT_REF` 三个 case 的全部逻辑迁移。
这三段逻辑之间共享 `lynxWorkletImpl` 访问模式，可以提取为内部 helper。

**对外导出**：

```ts
export function applySetWorkletEvent(
  id: number,
  eventType: string,
  eventName: string,
  ctx: Record<string, unknown>,
): void;

export function applySetMtRef(id: number, refImpl: unknown): void;

export function applyInitMtRef(wvid: number, initValue: unknown): void;

// 测试用
export function resetWorkletState(): void;
```

内部 helper（不导出）：

```ts
// 访问 globalThis.lynxWorkletImpl._refImpl，封装重复的 null check chain
function getWorkletRefImpl(): WorkletRefImpl | undefined;
```

---

## Step 4：精简 `ops-apply.ts`

改造后结构：

```ts
import { elements } from './element-registry.js';
import {
  isListParent,
  isPlatformInfoAttr,
  createListElement,
  insertListItem,
  setPlatformInfoProp,
  flushListUpdates,
} from './list-apply.js';
import {
  applySetWorkletEvent,
  applySetMtRef,
  applyInitMtRef,
} from './worklet-apply.js';

export function applyOps(ops: unknown[]): void {
  // duplicate-batch guard（不变）

  while (i < len) {
    switch (code) {
      case OP.CREATE: {
        // type === 'list'      → createListElement(id)
        // type === '__comment' → __CreateRawText('')
        // else                 → __CreateElement(type, 0) + __SetCSSId
        elements.set(id, el);
        break;
      }
      case OP.CREATE_TEXT: {
        /* 不变 */ break;
      }
      case OP.INSERT: {
        // isListParent(parentId) → insertListItem(parentId, child, childId)
        // else                   → __AppendElement / __InsertElementBefore
        break;
      }
      case OP.REMOVE: {
        /* 不变 */ break;
      }
      case OP.SET_PROP: {
        // isPlatformInfoAttr(key) → setPlatformInfoProp(id, key, value)
        // else                    → __SetAttribute
        break;
      }
      case OP.SET_TEXT: {
        /* 不变 */ break;
      }
      case OP.SET_EVENT: {
        /* 不变 */ break;
      }
      case OP.REMOVE_EVENT: {
        /* 不变 */ break;
      }
      case OP.SET_STYLE: {
        /* 不变 */ break;
      }
      case OP.SET_CLASS: {
        /* 不变 */ break;
      }
      case OP.SET_ID: {
        /* 不变 */ break;
      }

      case OP.SET_WORKLET_EVENT: {
        applySetWorkletEvent(ops[i++], ops[i++], ops[i++], ops[i++]);
        break;
      }
      case OP.SET_MT_REF: {
        applySetMtRef(ops[i++], ops[i++]);
        break;
      }
      case OP.INIT_MT_REF: {
        applyInitMtRef(ops[i++], ops[i++]);
        break;
      }
    }
  }

  flushListUpdates();
  __FlushElementTree();
}

export { elements };

export function resetMainThreadState(): void {
  elements.clear();
  resetListState();
  resetWorkletState();
}
```

预计精简后约 150 行，switch 循环清晰可读。

---

## Step 5：更新 `entry-main.ts`

```diff
- import { applyOps, elements } from './ops-apply.js'
+ import { elements } from './element-registry.js'
+ import { applyOps } from './ops-apply.js'
```

---

## Step 6：更新测试（`src/__test__/`）

- `resetMainThreadState()` 内部已 delegate 到各子模块，对外接口不变
- 如有针对 list/worklet 的单元测试，可直接 import `list-apply.ts` / `worklet-apply.ts` 独立测试其状态管理

---

## 关于 list 侵入 CREATE / INSERT / SET_PROP 的说明

即使拆出 `list-apply.ts`，这三个 case 里仍有"是否 list"的条件判断，这是不可避免的：
op stream 按操作类型编码，不按元素类型。

未来可引入 `CREATE_LIST: 14` op code 彻底消除 CREATE case 里的 `type === 'list'` 分支，
让 BG 侧显式选择不同 op code。但目前的好处是 BG 侧不需要感知 Lepus 使用 `__CreateList`，
保持了 BG/MT 解耦。等有 profiling 数据显示这是热点时再考虑。

---

## 改动范围

```
packages/vue/
├── shared/                    新建包（~30 行，private）
│   ├── package.json
│   ├── tsconfig.json
│   └── src/ops.ts
│
├── runtime/
│   ├── package.json           新增 dep: @lynx-js/vue-internal
│   └── src/ops.ts             OP 改为 re-export；pushOp/takeOps 不变
│
└── main-thread/
    ├── package.json           新增 dep: @lynx-js/vue-internal
    ├── rslib.config.ts        不 external vue-internal（inline 常量）
    └── src/
        ├── entry-main.ts      修改 import（elements 来源）
        ├── element-registry.ts 新建（~3 行）
        ├── ops-apply.ts        精简（~150 行）；OP 来自 vue-internal
        ├── list-apply.ts       新建（~200 行）
        └── worklet-apply.ts    新建（~120 行）
```

`rspeedy-plugin`、`e2e-lynx` 均无需改动。

## 验收标准

- [ ] `pnpm build` 在 `packages/vue/shared`、`packages/vue/runtime`、`packages/vue/main-thread` 全部通过
- [ ] `main-thread-bundled.js` 体积无显著增大（OP 常量内联，不引入运行时模块）
- [ ] `runtime/src/ops.ts` 中不再有 `const OP = { ... }` 本地定义
- [ ] `main-thread/src/ops-apply.ts` 中不再有 `const OP = { ... }` 本地定义，也不再有 "must stay in sync" 注释
- [ ] 现有 e2e-lynx demo（counter、gallery、swiper）在 LynxExplorer 行为不变
- [ ] `resetMainThreadState()` 在测试中仍正常清理全部状态
- [ ] 新文件中无 `console.log` 以外的调试遗留（SET_EVENT / SET_WORKLET_EVENT 的 `console.info` 保留）
