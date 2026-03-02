# Snapshot：编译器提示的虚拟 DOM

ReactLynx 使用一种名为 **Snapshot** 的技术——一种**编译器提示的虚拟 DOM（Compiler-Hinted Virtual DOM）**。其设计哲学与 [Vue 3 的编译器辅助虚拟 DOM](https://vuejs.org/guide/extras/rendering-mechanism.html#compiler-informed-virtual-dom) 相近：编译器静态分析 JSX，生成优化代码，使运行时可以跳过大部分 reconciliation 工作。但与完全的 AOT 编译不同，Snapshot 编译器是**保守的**：它只优化能在静态分析中证明安全的部分，未优化的路径仍然完整可用。

本文介绍 Snapshot 的工作原理、设计动机，以及它如何影响 ReactLynx 的渲染管线。

## 设计原则

理解 Snapshot 需要把握两个核心原则：

### 编译器是优化，不是替代

Snapshot 只转换**原生 JSX 元素**（`<view>`、`<text>` 等）——这些元素的结构必须能在编译期完整分析。以下场景**不会**被编译：

- **自定义组件** — `<MyButton>` 保持原样，由 Preact 正常 reconcile
- **展开运算符** — `<view {...props}>` 降级为运行时分发，因为编译器无法在构建时得知具体的 key
- **动态子树** — 静态元素与自定义组件混合的子树会被包裹在运行时管理的 "slot" 中

编译器无法优化的元素会回退到标准 Preact 代码路径。优化过的元素和未优化的元素在同一棵渲染树中共存——这正是设计意图。

### 编译器保持语义不变

Snapshot 变换是一个**纯优化**。移除它必须产生相同的可观测结果：

> 同一个程序，无论是否应用 Snapshot 变换，渲染结果应当完全一致。

因此运行时必须支持两条收敛的路径：

- **有编译**：Preact diff `{ values: [cls] }` → 数字索引的 patch → 编译器生成的 update 函数 → Element PAPI
- **无编译**：Preact diff `{ className: cls }` → 字符串 key 的 patch → 运行时字符串分发 → Element PAPI

两条路径产生相同的 Element PAPI 调用，因此渲染出相同的 UI。这种语义等价性使得编译器可以安全地渐进式采用——也使其可测试。

## 动机

在标准的 React（或 Preact）渲染器中，一个组件如：

```tsx
function Profile({ name, color }) {
  return (
    <view className={color}>
      <text>{name}</text>
    </view>
  );
}
```

每次渲染都会生成一棵虚拟 DOM 树。Reconciler 随后逐个 diff 每个元素的每个 prop——`<view>` 上的 `className`、`<text>` 上的文本内容，等等。这种逐 prop 的 diff 开销不小，尤其在移动端——ReactLynx 采用[双线程架构](/react/lifecycle)：reconciler 在后台线程运行，UI 在主线程，每次变更都需要跨线程传输。

Snapshot 编译器提供的 hint 让运行时能够跳过可静态分析元素的逐 prop diff。动态部分在构建期被提取出来，运行时只需比较一个扁平的 `values` 数组——一个 prop 代替多个。

## 工作原理

### 第一步：编译——静态/动态分离

SWC 编译器将原生 JSX 元素转换为 **snapshot 组件**：

```tsx
// 源码
<view className={cls}>
  <text>{name}</text>
</view>;
```

```tsx
// 编译产物（简化）
<__snapshot_a1b2 values={[cls, name]} />;
```

编译器同时生成一份 **snapshot 定义**——一个模板，告诉运行时如何创建元素、如何更新每个动态部分：

```js
// 编译器生成的 snapshot 定义（简化）
{
  create(ctx) {
    const view = __CreateView(pageId);
    const text = __CreateText(pageId);
    __AppendElement(view, text);
    return [view, text];
  },

  update: [
    // update[0]: cls → className
    (ctx) => __SetClasses(ctx.__elements[0], ctx.__values[0]),
    // update[1]: name → 文本内容
    (ctx) => __SetAttribute(ctx.__elements[1], 'text', ctx.__values[1]),
  ],
}
```

关键洞察：**`className` 等 prop 名称永远不会出现在运行时 diff 路径中**。它们已被编译为直接的 [Element PAPI](https://lynxjs.org/api/) 调用，通过 `values` 数组中的位置索引。

### 第二步：Diff——一个 Prop 代替多个

在运行时，Preact 看到每个 snapshot 组件只有一个 prop：`values`。

```
上次渲染：{ values: ["red",  "Alice"] }
本次渲染：{ values: ["blue", "Alice"] }
```

Preact 的 diff 检测到 `values[0]` 发生了变化，调用：

```js
bsi.setAttribute(0, 'blue'); // 数字索引，不是 "className"
```

这个操作被记录为一条 **patch**，等待跨线程传输。Preact 对 `className` 和 `style` 一无所知——它只是在搬运数组索引和值。

### 第三步：Patch——跨越线程边界

Preact diff 结束后，所有累积的操作被序列化，从后台线程发送到主线程：

```
后台线程                               主线程
────────                               ──────
Preact diff
  └─ bsi.setAttribute(0, "blue")
       └─ push 到 patch 数组

commit hook 触发
  └─ JSON.stringify(patches)  ──IPC──►  snapshotPatchApply()
                                          └─ si.setAttribute(0, "blue")
                                               └─ update[0](si)
                                                    └─ __SetClasses(el, "blue")
```

在主线程上，`setAttribute(0, "blue")` 触发编译器生成的 `update[0]` 函数，直接调用 `__SetClasses`——没有 prop 名称查找，没有 switch 分支。

### 完整管线

```
<view className={cls}>hello</view>
              │
              ▼  SWC 编译器（构建期）
              │
<__snapshot_a1b2 values={[cls]}>hello</__snapshot_a1b2>
+ snapshot_def = {
    create(ctx) { ... },
    update: [(ctx) => __SetClasses(ctx.__elements[0], ctx.__values[0])],
  }
              │
              ▼  Preact diff（后台线程）
              │
比较 { values: ["red"] } vs { values: ["blue"] }
→ bsi.setAttribute(0, "blue")
              │
              ▼  Patch 序列化 + IPC
              │
[SetAttribute, id, 0, "blue"]
              │
              ▼  snapshotPatchApply（主线程）
              │
si.setAttribute(0, "blue")
→ si.__values[0] = "blue"
→ snapshot_def.update[0](si)           // 编译器生成
→ __SetClasses(el, si.__values[0])     // Element PAPI
```

## 编译后 Preact 的角色

对于已编译的元素，Preact reconciler 被简化为三项工作：

1. **树结构 reconciliation** — 挂载、卸载、重排序（与标准 React 相同）
2. **搬运 values 数组** — 浅比较一个 prop，将逐索引的变更转发给 BSI
3. **触发 commit hook** — 驱动 patch 跨线程刷新

对于已编译的元素，Preact 不会调用 `setProperty(element, 'className', value)`——该代码路径被完全跳过。

对于未编译的元素（自定义组件、展开运算符、动态子树），Preact 执行标准的逐 prop diff。两种模式无缝共存：

```
<App>                         ← 自定义组件，标准 Preact diff
  <__snapshot_xyz values={…}> ← 已编译，仅 diff values
    <MyList>                  ← 自定义组件，标准 Preact diff
      <__snapshot_abc …>      ← 已编译，仅 diff values
```

## 哪些被编译了

编译器对原生元素上的属性进行分类：

| 类别     | 示例                        | 处理方式                                       |
| -------- | --------------------------- | ---------------------------------------------- |
| **静态** | `<view className="header">` | 写入 `create` 函数中。更新时零开销。           |
| **动态** | `<view className={cls}>`    | 提取到 `values[i]`，生成 `update[i]` 函数。    |
| **展开** | `<view {...props}>`         | 生成 `updateSpread()` 调用——运行时字符串分发。 |

### 展开运算符：运行时回退

当编译器遇到展开运算符（`<view {...props} />`）时，无法静态提取各个属性，转而生成对 `updateSpread()` 的调用。该函数在运行时按字符串 key 分发：

```js
// updateSpread()——简化版
for (const key in newProps) {
  if (key === 'className')       __SetClasses(el, value);
  else if (key === 'style')      __SetInlineStyles(el, value);
  else if (key === 'id')         __SetID(el, value);
  else if (key.startsWith('data-'))  __AddDataset(el, ...);
  else if (eventPattern.test(key))   __AddEvent(el, ...);
  else                           __SetAttribute(el, key, value);
}
```

这是运行时中**唯一**将字符串属性名映射到 Element PAPI 方法的地方。它能正确工作，但因为涉及字符串比较，比编译路径慢。在性能敏感的代码中，应优先使用显式 prop 而非展开运算符。

## 两条路径：有编译与无编译

因为变换是一个纯优化，运行时支持两条完整的代码路径，它们收敛到相同的结果。

**路径 A——有编译（生产环境）：**

```
<view className={cls}>
  → <__snapshot values={[cls]}>
    → bsi.setAttribute(0, newCls)          // 数字索引
      → [SetAttribute, id, 0, newCls]      // patch
        → update[0](si)                    // 编译器生成
          → __SetClasses(el, newCls)       // Element PAPI
```

**路径 B——无编译：**

```
<view className={cls}>
  → createElement("view", { className: cls })
    → bsi.setAttribute("className", cls)   // 字符串 key
      → [SetAttribute, id, "className", cls]  // patch
        → 运行时字符串分发                   // 类 updateSpread 逻辑
          → __SetClasses(el, cls)          // Element PAPI
```

两条路径最终都调用了 `__SetClasses(el, cls)`。渲染结果完全一致。

### 为什么这很重要

语义等价不仅是理论性质——它是一个**可测试的不变量**：

- **渐进式采用** — 可以按文件启用编译。已编译和未编译的代码共存。
- **调试** — 禁用变换来区分是编译器的 bug 还是应用逻辑的 bug。
- **无编译器测试** — 将 Preact 上游测试套件在 ReactLynx 管线上运行，_不使用_ Snapshot 变换，验证运行时的未编译路径产生正确结果。
- **有编译器测试** — [ReactLynx Testing Library](/react/reactlynx-testing-library) 端到端验证完整的编译管线。

两者共同构成一个正确性论证：如果路径 B 匹配上游 Preact 的语义，且路径 A 匹配路径 B 的输出，那么路径 A 就是正确的。

## 实践指南

### 性能

- **每个变更值的更新是 O(1)** — 每个动态部分对应一个直接函数调用，无需搜索或字符串匹配。
- **未变更的值零开销** — `isDirectOrDeepEqual(old, new)` 会跳过 update 函数。
- **静态属性更新时零开销** — 在 `create` 中设置一次，之后不再重新求值。
- **展开运算符较慢** — 涉及运行时字符串分发。在热路径上使用显式 prop。

### 优化建议

不必担心：

- 静态 prop 的数量——更新时它们是免费的
- Prop 的顺序——对性能没有影响
- 元素数量——只有动态部分会生成 update 代码

值得关注：

- 减少频繁变化的动态值
- 在热路径组件上优先使用显式 prop 而非展开运算符
- 在性能关键的子树中保持 `values` 数组尽可能小

### 序列化约束

Patch 通过 `JSON.stringify` 跨越线程边界。值必须是 JSON 可序列化的：

- `NaN` 在传输中变为 `null`
- `BigInt` 会抛出异常
- 函数由运行时单独管理（事件处理器使用字符串标识符）
- 循环引用会导致错误

实际开发中这很少成为问题——元素属性通常是字符串、数字或简单对象。

## 横向对比

|            | React                       | Vue 3                    | ReactLynx Snapshot                       |
| ---------- | --------------------------- | ------------------------ | ---------------------------------------- |
| 编译器角色 | 无（纯运行时）              | Patch flags + 静态提升   | 完整的静态/动态分离 + 代码生成           |
| Prop diff  | 运行时逐 prop               | 运行时 + 跳过提示        | 已编译：按索引。未编译：按 prop。        |
| 更新分发   | `setProperty(el, key, val)` | 带 flags 的 `patchProp`  | `update[i](ctx)` → 直接 PAPI 调用        |
| 无编译器时 | 不适用                      | render 函数（完整 diff） | 标准 Preact diff → 运行时分发 → 结果相同 |
| 线程模型   | 单线程                      | 单线程                   | 双线程                                   |

与 Vue 3 类似，Snapshot 是一种编译器提示的虚拟 DOM：保留了虚拟 DOM 的编程模型和灵活性，同时利用静态分析跳过不必要的工作。与 Vue 3 的 patch flags（给运行时 diff 算法的提示）不同，ReactLynx 直接生成 update 函数体本身——这是一种更深层的编译，由双线程架构驱动：最小化跨线程 patch 体积至关重要。

## 总结

Snapshot 是驱动 ReactLynx 的编译器提示虚拟 DOM：

1. **保守设计** — 只编译能在静态分析中证明安全的部分。自定义组件、展开运算符和动态子树回退到标准 Preact diff。
2. **语义不变** — 同一程序有无变换均产生相同输出。这使得优化安全、可渐进采用、可测试。
3. **高效** — 已编译元素将 Preact 简化为 `values` 数组 diff。每个动态部分获得一个直接的 Element PAPI 调用，无运行时分发。
4. **双线程原生** — Patch 携带索引值而非键值对，跨线程序列化开销最小。

你写标准的 React JSX。编译器提供 hint。运行时处理两条路径。
