# Vue Upstream Tests — Test Report

## Overview

We run vuejs/core v3.5.12 upstream test suites against the Lynx Vue pipeline to validate compatibility.

**Total: 941 tests across 48 suites — 800 pass, 141 skip, 0 fail**

| Config                                         | Suites | Pass    | Skip    | Fail  |
| ---------------------------------------------- | ------ | ------- | ------- | ----- |
| `pnpm test` (runtime-core, reactivity, shared) | 43     | 778     | 97      | 0     |
| `pnpm test:dom` (runtime-dom)                  | 5      | 22      | 44      | 0     |
| **Total**                                      | **48** | **800** | **141** | **0** |

### By package

| Package      | Suites | Pass | Skip |
| ------------ | ------ | ---- | ---- |
| runtime-core | 23     | 382  | 82   |
| reactivity   | 15     | 384  | 13   |
| shared       | 5      | 46   | 0    |
| runtime-dom  | 5      | 22   | 44   |

> _Note: `computed.spec.ts` (48 tests) excluded due to module initialization conflict; 4 gc tests auto-skipped by `describe.skipIf(!global.gc)`._

---

但上面的数字中，**reactivity（384）和 shared（46）测的是从 npm 直装的 `@vue/reactivity@3.5.0` / `@vue/shared@3.5.0`**。它们验证的是 Vue 官方代码，不是我们的管道。在这里只起版本兼容性烟雾测试的作用。

**真正验证我们管道正确性的是 runtime-core + runtime-dom：**

| 层               | 验证了什么                                | Pass    | Skip    |
| ---------------- | ----------------------------------------- | ------- | ------- |
| **runtime-core** | ShadowElement 链表 ↔ Vue VDOM diff 契约   | 382     | 82      |
| **runtime-dom**  | patchProp → ops → applyOps → PAPI → jsdom | 22      | 44      |
| **合计**         |                                           | **404** | **126** |

去掉与我们代码无关的 skip（Vue 内部 API 57 + 版本差异 10 + 内部符号 3 + GC 4 = 74），有效分母为 **867 tests，通过 800，有效通过率 92.3%**。

---

## Skip 归因分析

141 个 skip 中，74 个（52.5%）与我们的代码无关——它们测的是 Vue 内部调度器、VNode 归一化等不经过 renderer 的路径，或是 npm 包版本差异。

**剩余 67 个有效 skip 按根因分为三类：**

### 汇总

| 根因                     | 数量   | 占有效 skip | 说明                       |
| ------------------------ | ------ | ----------- | -------------------------- |
| ① Web/Lynx 平台差异      | **25** | **37.3%**   | Lynx 不支持的 Web 平台特性 |
| ② Vue → VueLynx 管道差异 | **14** | **20.9%**   | PAPI 管道的设计约束        |
| ③ 测试机制限制           | **28** | **41.8%**   | adapter/bridge 的实现局限  |
| **合计**                 | **67** | **100%**    |                            |

---

### ① Web/Lynx 平台差异（25 tests）

Lynx 作为跨端框架，不具备部分 Web 平台能力。**这些 skip 对 Lynx 平台团队有参考价值**——如果 Lynx 未来补齐某项能力，对应测试可直接恢复。

| 子类                      | 数量 | 典型示例                                                       |
| ------------------------- | ---- | -------------------------------------------------------------- |
| DOM Property vs Attribute | 15   | `input.value` 是 DOM property，Lynx PAPI 只有 `__SetAttribute` |
| SVG                       | 5    | Lynx 无 SVG 元素                                               |
| .prop / ^attr 修饰符      | 2    | Vue 的 `.value` / `^disabled` 强制修饰符                       |
| 表单元素 DOM 行为         | 2    | `<select>` / `<option>` value 反射                             |
| Web Components            | 1    | 自定义元素事件名映射                                           |

### ② Vue → VueLynx 管道差异（14 tests）

我们的 PAPI 管道用 `Object.assign(el.style, obj)` 设置样式、`JSON.stringify` 序列化属性值。这与 Vue runtime-dom 直接操作 DOM API 有差异。**这些 skip 对 VueLynx 管道优化有参考价值。**

已修复：CSS 自定义属性（`__SetInlineStyles` 改用 `setProperty`）、布尔属性（bridge 层用 `isBooleanAttr` 转换）。

| 子类                             | 数量 | 根因                                                      |
| -------------------------------- | ---- | --------------------------------------------------------- |
| Style: `Object.assign` 限制      | 8    | 不支持 `!important`、简写展开、厂商前缀、多值回退         |
| Attribute: `JSON.stringify` 限制 | 3    | `Symbol` 丢失                                             |
| 事件系统差异                     | 3    | native `onclick` 字符串、Vue 时间戳防护、类型检查 warning |

### ③ 测试机制限制（28 tests）

adapter（`lynx-runtime-test.ts`）和 bridge（`lynx-runtime-dom-bridge.ts`）作为测试工具的实现局限。**这些不反映真实管道的问题，价值相对较低。**

| 子类                            | 数量 | 原因                                                                   |
| ------------------------------- | ---- | ---------------------------------------------------------------------- |
| Adapter: ref owner / el binding | 12   | directive `el` 收到 TestNode 包装器；`render()` 未设 ref owner context |
| Adapter: flush 时序             | 6    | `flush: 'pre'` / `'post'` 精确时序依赖内部 scheduler                   |
| Adapter: 其他                   | 5    | template ref 转发、KeepAlive include、scopeId + Suspense               |
| Bridge: 不支持完整 `render()`   | 5    | bridge 仅支持 `patchProp`，不支持 `render(h(...), container)`          |

---

### 附：与我们代码无关的 skip（74 tests）

| 子类         | 数量 | 说明                                                       |
| ------------ | ---- | ---------------------------------------------------------- |
| Vue 内部 API | 57   | scheduler 队列排序 (34)、VNode/Slots/Props/Emits 内部 (23) |
| 版本差异     | 10   | `@vue/reactivity` 3.5.0 vs upstream 3.5.12                 |
| GC auto-skip | 4    | 需 `--expose-gc`                                           |
| 内部符号     | 3    | `targetMap` / `getDepFromReactive` 不在公共 API            |
