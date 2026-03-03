# Vue Vine × Lynx 实现分析

## 概览

`vue-vine/exp/vue-vine-lynx` 分支通过 18 个 commit 实现了一个基于 Vue Vine 的 "Vue on Lynx" 方案。核心思路是：利用 Vue 3 的 Custom Renderer API，为 Lynx 的双线程架构（Main Thread + Background Thread）构建完整的渲染管线，同时复用 Vue Vine 的函数式组件语法。

### 新增 Packages

| Package                             | 用途                                                 |
| ----------------------------------- | ---------------------------------------------------- |
| `@vue-vine/runtime-lynx`            | Vue 3 自定义渲染器 + 双线程事件系统 + Worklet 运行时 |
| `@vue-vine/rspeedy-plugin-vue-vine` | Rspeedy/Rsbuild 构建插件，处理双 Bundle 拆分         |
| `packages/e2e-lynx`                 | 演示/测试应用（day-1 到 day-4 递进展示）             |

### 修改的核心模块

| 模块                     | 变更内容                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `packages/compiler`      | 新增 Lynx transform（worklet 提取）、`'main thread'` / `'background only'` directive 分析 |
| `packages/rspack-loader` | 注入 `LYNX_BUILTIN_COMPONENTS` 为 custom element                                          |
| `packages/vue-vine`      | 新增 `lynx-shims.d.ts` 类型定义                                                           |

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Lynx Native Platform                    │
├────────────────────────────┬────────────────────────────────┤
│     Main Thread (Lepus)    │     Background Thread          │
│  ┌──────────────────────┐  │  ┌──────────────────────────┐  │
│  │ Vue 3 Custom Renderer│  │  │ 仅负责事件转发            │  │
│  │ (PAPI 访问)          │  │  │ (无 PAPI 访问)           │  │
│  │                      │  │  │                          │  │
│  │ - createElement      │  │  │ publishEvent()           │  │
│  │ - patchProp          │  │  │   → forwardToMainThread  │  │
│  │ - insert/remove      │  │  │                          │  │
│  │ - event handlers     │  │  │ re-export @vue/runtime-  │  │
│  │ - worklet runtime    │  │  │   core (for types)       │  │
│  └──────────────────────┘  │  └──────────────────────────┘  │
│           ↑                │             │                   │
│           └────── dispatchEvent('vue-vine-event') ──────────│
└─────────────────────────────────────────────────────────────┘
```

**关键设计决策：Vue 渲染跑在 Main Thread。**

与 ReactLynx（渲染逻辑在 Background Thread、通过 element tree diff 同步到 Main Thread）不同，Vue Vine 方案把整个 Vue Custom Renderer 放在 Main Thread (Lepus) 上运行——因为 Lepus 有 PAPI 访问权限，可以直接调用 `__CreateView()`、`__AppendElement()` 等原生 API。Background Thread 被简化为纯粹的事件中转层。

---

## 二、Runtime-Lynx 详解

### 2.1 自定义渲染器 (renderer/)

**`renderer/index.ts`** — 用 `createRenderer<LynxElement, LynxElement>()` 创建 Vue 自定义渲染器，暴露 `createLynxApp()` 工厂函数。

核心设计：**延迟挂载**

```typescript
// app.mount() 不会立即执行，只标记 pending
const mount = (): ComponentPublicInstance => {
  __mountPending = true;
  return __mountedInstance ?? {};
};

// 真正挂载在 Lynx Native 调用 renderPage() 时才执行
function executeMountToPage(page: LynxElement) {
  const vnode = createVNode(rootComponent, rootProps);
  render(vnode, page);
  __FlushElementTree();
}
```

**`renderer/node-ops.ts`** — 将 Vue DOM 操作映射到 Lynx PAPI：

| Vue 操作                        | Lynx PAPI                                      |
| ------------------------------- | ---------------------------------------------- |
| `createElement('view')`         | `__CreateView(componentId)`                    |
| `createElement('text')`         | `__CreateText(componentId)`                    |
| `createElement('image')`        | `__CreateImage(componentId)`                   |
| `createElement('scroll-view')`  | `__CreateScrollView(componentId)`              |
| `createText(str)`               | `__CreateRawText(str)`                         |
| `insert(child, parent)`         | `__AppendElement(parent, child)`               |
| `insert(child, parent, anchor)` | `__InsertElementBefore(parent, child, anchor)` |
| `remove(child)`                 | `__RemoveElement(parent, child)`               |
| `setText(node, text)`           | `__SetAttribute(node, 'text', text)`           |

每个操作后调用 `scheduleLynxFlush()` 批量提交。

**`renderer/patch-prop.ts`** — 属性更新，支持 4 种事件绑定模式：

1. **Vue 风格事件** (`onTap`, `onClick` → `/^on[A-Z]/`)
   - 转换为 Lynx 事件名：`onTap` → `tap`
   - 注册 handler 到 registry，拿到 sign，调用 `__AddEvent(el, 'bindEvent', eventName, sign)`

2. **Lynx 原生事件** (`bindtap`, `catchtap`, `global-bindscroll`)
   - 正则匹配：`/^(global-bind|bind|catch|...)(\w+)/i`
   - 同样通过 sign 机制注册

3. **主线程 Worklet 事件** (`main-thread:bindtap`)
   - 正则匹配：`/^main-thread:(global-bind|bind|catch|...)(\w+)/i`
   - 检测 `isWorklet(nextValue)` 后直接传递 worklet 对象给 `__AddEvent`

4. **普通属性**：`class` → `__SetClasses()`，`style` → `__AddInlineStyle()`（驼峰转 kebab），`id` → `__SetID()`，其余 → `__SetAttribute()`

### 2.2 事件系统

**三层架构：**

```
Background Thread                Main Thread
┌───────────────────┐           ┌──────────────────────────┐
│ publishEvent-     │           │ event-registry.ts        │
│   Background()    │           │ ┌──────────────────────┐ │
│                   │           │ │ Map<sign, handler>   │ │
│ → forwardEvent-   │  dispatch │ │                      │ │
│   ToMainThread()  ├──────────→│ │ executeEventHandler()│ │
│                   │ 'vue-vine │ └──────────────────────┘ │
│ event-forward.ts  │  -event'  │                          │
└───────────────────┘           │ event-receive.ts         │
                                │ setupEventsReceive()     │
                                └──────────────────────────┘
```

- **Sign 机制**：每个事件 handler 注册时生成 6 位随机 sign（`Math.random().toString(36)`），通过 sign 跨线程引用 handler
- **跨线程通信**：`lynx.getCoreContext().dispatchEvent({type: 'vue-vine-event', data: JSON.stringify({handlerSign, eventData})})`
- **主线程接收**：`lynx.getJSContext().addEventListener('vue-vine-event', callback)`

### 2.3 Worklet 运行时

`worklet-runtime.ts` 实现主线程高性能事件处理（无跨线程开销）：

- **Worklet 对象结构**：`{ _wkltId: string, _c?: object }` (闭包上下文)
- **注册**：`registerWorklet("main-thread", id, fn)` 存入全局 `_workletMap`
- **执行**：`runWorklet(worklet, params)` 查找函数并执行，参数中的 `elementRefptr` 自动包装为 `MainThreadElement`
- **`MainThreadElement`** 封装类：提供 `setAttribute()`, `setStyleProperty()`, `setStyleProperties()` 等方法，直接调用 PAPI 并批量 flush

### 2.4 调度器

```typescript
let flushScheduled = false;
function scheduleLynxFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  queuePostFlushCb(() => {
    flushScheduled = false;
    __FlushElementTree();
  });
}
```

利用 Vue 的 `queuePostFlushCb()` 确保所有响应式更新完成后，只调用一次 `__FlushElementTree()`。

### 2.5 入口文件

**Main Thread (`entry-main.ts`)**：

1. `setupLynxEnv()` — 初始化 `lynx.__initData`、`lynx.reportError`、`processData`
2. `injectCalledByNative()` — 注入 `renderPage()`、`updatePage()` 等 Lynx 生命周期回调
3. `initWorkletRuntime()` — 初始化 worklet 映射和事件监听
4. `setupEventsReceive()` — 监听跨线程事件
5. 导出 `createLynxApp` 和 `render`

**Background Thread (`entry-background.ts`)**：

- 仅注入 `publishEvent` → `forwardEventToMainThread()`
- Re-export `@vue/runtime-core` 的所有内容

---

## 三、Compiler 变更

### 3.1 `'main thread'` / `'background only'` Directive

**分析阶段** (`analyze.ts`)：遍历所有函数声明/箭头函数/函数表达式，检测函数体的 directive：

```typescript
function handler() {
  'main thread'; // ← 被识别为 VineLynxDirectiveType
  // ...
}
```

**转换阶段** (`transform/lynx.ts`)：

对 `'main thread'` 函数：

1. 提取函数体为内部变量 `__vine_wklt_${fnName}_fn`
2. 原变量替换为 worklet 对象 `{ _wkltId: "${md5Hash}:${index}" }`
3. 注入条件注册代码：

```javascript
if (typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__) {
  globalThis.registerWorklet?.(
    'main-thread',
    '${wkltId}',
    __vine_wklt_handler_fn,
  );
}
```

对 `'background only'` 函数：

- 包裹在 `if (__BACKGROUND__) { ... }` 中，主线程 bundle 中被 tree-shake 掉

### 3.2 模板编译适配

`template/compose.ts` 中，当 `lynx.enabled` 时：

- `runtimeModuleName` 从 `'vue'` 改为 `'@vue-vine/runtime-lynx'`
- 避免引入 `@vue/runtime-dom`（含 DOM API，Lepus 中不可用）

### 3.3 Import 管理

`transform/steps.ts` 和 `transform.ts` 中：

- 根据 `lynx.enabled` 动态选择 runtime module
- `import { defineComponent, ... } from '@vue-vine/runtime-lynx'`（而非 `'vue'`）

### 3.4 Custom Element 注册

`rspack-loader/context.ts` 中：

```typescript
if (compilerOptions.lynx?.enabled) {
  compilerOptions.vueCompilerOptions.isCustomElement = (tag) =>
    LYNX_BUILTIN_COMPONENTS.includes(tag); // view, text, image, scroll-view, ...
}
```

防止 Vue 将 Lynx 原生组件当作自定义组件处理。

---

## 四、构建系统 (rspeedy-plugin-vue-vine)

### 4.1 双 Bundle 拆分

插件将每个 entry 拆分为两个 rspack entry：

| Entry                 | Layer                  | 入口文件                                             | 产物             |
| --------------------- | ---------------------- | ---------------------------------------------------- | ---------------- |
| `{name}__main-thread` | `vue-vine:main-thread` | `@vue-vine/runtime-lynx/entry-main` + 用户代码       | `main-thread.js` |
| `{name}`              | `vue-vine:background`  | `@vue-vine/runtime-lynx/entry-background` + 用户代码 | `background.js`  |

### 4.2 编译时宏

通过 SWC optimizer 的 `globals` 进行编译时常量替换：

| 宏                    | Main Thread | Background |
| --------------------- | ----------- | ---------- |
| `__MAIN_THREAD__`     | `true`      | `false`    |
| `__BACKGROUND__`      | `false`     | `true`     |
| `__DEV__`             | 根据环境    | 根据环境   |
| `__VUE_OPTIONS_API__` | `true`      | `true`     |

### 4.3 Loader 管线

每个 layer 有独立的 loader 规则：

```
.vine.ts 文件:  vine-loader → swc-loader（注入宏）
普通 .ts 文件:  swc-loader（仅注入宏）
```

`vine-loader` 使用 `compilerOptions: { lynx: { enabled: true } }` 触发 Lynx 编译模式。

### 4.4 Webpack 插件链

1. **`MainThreadAssetMarkerPlugin`** — 标记主线程产物 `lynx:main-thread: true`
2. **`RuntimeWrapperWebpackPlugin`** — 包裹 background JS 为 Lynx 可执行格式
3. **`LynxEncodePlugin`** — 内联脚本编码
4. **`LynxTemplatePlugin`** — 生成 `.lynx.bundle`（targetSdkVersion: '3.2'）
5. **`DefinePlugin`** — 注入共享编译常量

---

## 五、演示应用递进

| 阶段  | 文件            | 能力                                                                                                                       |
| ----- | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Day 1 | `day-1.ts`      | 纯 `h()` 渲染函数，静态 `<view>` + `<text>`，验证基本渲染管线                                                              |
| Day 2 | `day-2.ts`      | `ref()` 响应式 + `setInterval` 定时更新 + `bindtap` 事件绑定                                                               |
| Day 3 | `day-3.vine.ts` | Vue Vine 模板语法 `vine\`...\``，组件组合，模板插值                                                                        |
| Day 4 | `day-4.vine.ts` | **核心突破**：Background vs Main Thread 事件对比，`scroll-view` + `global-bindscroll`，主线程直接操作 `setStyleProperty()` |

Day 4 同时展示了两种事件处理模式的性能差异：

- **Background 模式**：`global-bindscroll` → 更新 `ref()` → 触发 re-render → 跨线程同步
- **Main Thread 模式**：`main-thread:global-bindscroll` → worklet 直接调用 PAPI → 零延迟

---

## 六、与 ReactLynx 的对比

| 维度             | Vue Vine on Lynx                   | ReactLynx                      |
| ---------------- | ---------------------------------- | ------------------------------ |
| **渲染线程**     | Main Thread (Lepus)                | Background Thread              |
| **跨线程同步**   | 事件从 BG → Main（单向）           | Element Tree diff 从 BG → Main |
| **PAPI 访问**    | 直接在渲染器中调用                 | 通过 diff 间接操作             |
| **Bundle 数**    | 2 (main-thread.js + background.js) | 2 (同)                         |
| **背景线程职责** | 仅事件转发                         | 运行 React + 生成 element tree |
| **主线程职责**   | Vue 渲染 + 事件处理 + Worklet      | 应用 diff + 事件转发           |
| **Worklet**      | 编译器提取 `'main thread'` 函数    | `'main thread'` 指令 + 编译器  |
| **模板语法**     | `vine\`<view>...\``                | JSX `<view>...`                |

**核心差异**：Vue Vine 方案将所有 UI 逻辑集中在 Main Thread，利用 Lepus 的 PAPI 直接操控元素树，简化了跨线程通信。代价是 Main Thread 的 JS 负载更重，但避免了 ReactLynx 需要的 element tree diff 和同步机制。

---

## 七、关键实现洞察

1. **Sign-based 事件注册**：用 6 位随机字符串作为跨线程事件引用，避免序列化函数
2. **延迟挂载模式**：`app.mount()` 只标记 pending，等 `renderPage()` 回调时才真正创建 VNode 树
3. **单次 Flush 策略**：所有 DOM 操作后调用 `scheduleLynxFlush()`，利用 `queuePostFlushCb` 确保每个 tick 只调 `__FlushElementTree()` 一次
4. **编译器 Worklet 提取**：用 MD5(fileId:fnName:index) 生成确定性 worklet ID，确保跨 build 稳定
5. **最小化 Background Bundle**：背景线程仅包含 `event-forward.ts`（~30 行），不包含 Vue 渲染器
6. **`isCustomElement` 注入**：在 rspack-loader 层自动将 `view/text/image/...` 标记为 custom element，避免 Vue 编译警告
