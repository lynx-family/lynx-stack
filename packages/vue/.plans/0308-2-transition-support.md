# Vue Lynx — Transition / TransitionGroup 支持

## Context

Vue 的 `<Transition>` 和 `<TransitionGroup>` 是最常用的内置组件之一。架构上分两层：

1. **`BaseTransition`**（`@vue/runtime-core`）— 平台无关的状态机，管理 enter/leave 生命周期、`mode`（in-out / out-in）、`appear`、`persisted` 等。通过 `resolveTransitionHooks()` 产生 `TransitionHooks` 对象，挂到 VNode 上。**这层我们免费复用，无需任何修改。**

2. **`Transition` / `TransitionGroup`**（`@vue/runtime-dom`）— DOM 特定实现。在 hooks 里做 CSS class 切换（`-enter-from` → `-enter-active` → `-enter-to`）、监听 `transitionend` / `animationend` 事件、`forceReflow()`。**这层需要为 Lynx 重写。**

### Lynx 的 CSS 动画能力

Lynx 原生支持完整的 CSS animation/transition 属性：

| 类型                  | 支持的属性                                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSS Transition**    | `transition-property`, `transition-duration`, `transition-delay`, `transition-timing-function`                                                                                            |
| **CSS Animation**     | `animation-name`, `animation-duration`, `animation-timing-function`, `animation-delay`, `animation-iteration-count`, `animation-direction`, `animation-fill-mode`, `animation-play-state` |
| **@keyframes**        | 完整支持                                                                                                                                                                                  |
| **Animation Events**  | `animationstart`, `animationend`, `animationiteration`, `animationcancel`                                                                                                                 |
| **Transition Events** | `transitionstart`, `transitionend`, `transitioncancel`                                                                                                                                    |
| **可动画属性**        | `opacity`, `transform`, `background-color`, `color`, `width`, `height`, `border-*`, `padding`, `margin`, `top/right/bottom/left` 等                                                       |
| **JS Animation API**  | `element.animate(keyframes, options)` — Main Thread 上的命令式动画                                                                                                                        |

**关键发现**：Lynx 的 CSS transition 和 animation 能力与浏览器基本一致，包括事件回调。这意味着我们可以沿用 Vue DOM 版本的 **CSS class 切换方案**，而不需要走 JS animation API。

### 核心挑战：双线程下的动画协调

Vue DOM 版 `<Transition>` 的工作流：

```
beforeEnter: addClass('enter-from', 'enter-active')
  → insert element into DOM
  → nextFrame: removeClass('enter-from'), addClass('enter-to')
  → transitionend event: removeClass('enter-active', 'enter-to'), call afterEnter
```

在我们的双线程架构下：

- **BG Thread**：`BaseTransition` 状态机触发 hooks → hooks 生成 SET_CLASS ops → ops flush 到 Main Thread
- **Main Thread**：应用 class → Lynx 引擎执行 CSS transition → 产生 `transitionend` 事件 → 回调到 BG

**问题 1：`nextFrame` 语义**
DOM 版用 `requestAnimationFrame` + `requestAnimationFrame`（双 rAF）来确保 enter-from class 已经被浏览器 layout 后再切换到 enter-to。在双线程模型下，ops flush 本身就引入了一个异步边界（跨线程通信），这实际上**天然满足了 nextFrame 的需求** — 当 BG 收到 flush 完成的 ack 时，Main Thread 已经应用了 enter-from class 并完成了至少一次 layout。

**问题 2：`transitionend` 事件路由**
`transitionend` 是一个 DOM 事件。在 Lynx 中，我们需要通过现有的事件系统（`bindtransitionend` / `bindanimationend`）将它路由回 BG Thread 的 handler。现有的 `SET_EVENT` ops 和 `publishEvent` 机制已经支持这个路径。

**问题 3：`forceReflow()`**
DOM 版在 `beforeEnter` 中设置 class 后，调用 `el.offsetHeight` 强制 reflow，确保 enter-from 的初始状态被应用。在双线程模型下，ops 跨线程执行后再回来，本身就有 reflow 效果。但如果我们在**同一个 ops batch** 里先 SET_CLASS('enter-from enter-active') 再 SET_CLASS('enter-to enter-active')，Lynx 可能合并掉中间状态。因此需要 **分两个 batch** 发送。

---

## Goals

1. 实现 `<Transition>` 组件，支持 CSS class-based 动画和 JS hooks
2. 实现 `<TransitionGroup>` 组件，支持列表的 enter/leave/move 动画
3. 复用 `@vue/runtime-core` 的 `BaseTransition` 状态机，零修改
4. 适配 Lynx 的 CSS transition/animation 能力和事件系统
5. 从 `@lynx-js/vue-runtime` 导出，用户体验与 Vue DOM 版一致

## Non-Goals

1. **JS animation API 集成**：不在 `<Transition>` 中直接调用 `element.animate()`。用户可以通过 JS hooks 自行调用
2. **FLIP move 动画**：`<TransitionGroup>` 的 move 动画需要读取元素的 bounding rect（`getBoundingClientRect()`），这在双线程下需要跨线程同步查询。Phase 1 不做 move，Phase 2 再考虑
3. **`<Transition>` 与 `<KeepAlive>` 联动**：组合使用暂不验证
4. **Performance 优化**：先做正确，再做快

---

## Architecture

### 层次关系

```
┌──────────────────────────────────────────────────────────┐
│  User code:  <Transition name="fade">                    │
│                <div v-if="show">Hello</div>              │
│              </Transition>                               │
├──────────────────────────────────────────────────────────┤
│  LynxTransition (our code)                               │
│  ├─ wraps BaseTransition (from runtime-core)             │
│  ├─ resolveTransitionProps() → converts name/props       │
│  │   into BaseTransitionProps with hooks                 │
│  └─ hooks do: pushOp(SET_CLASS, ...) + event binding     │
├──────────────────────────────────────────────────────────┤
│  BaseTransition (runtime-core, unmodified)               │
│  ├─ state machine: isMounted, isLeaving, leavingVNodes   │
│  ├─ calls hooks.beforeEnter() / hooks.enter() /          │
│  │   hooks.leave() at the right moments                  │
│  └─ manages mode (in-out / out-in) and delayLeave        │
├──────────────────────────────────────────────────────────┤
│  nodeOps (existing) → pushOp → ops buffer → flush        │
├──────────────────────────────────────────────────────────┤
│  Main Thread: applyOps() → __SetClasses / __AddEvent     │
│  Lynx Engine: CSS transition/animation → transitionend   │
│  → publishEvent → BG handler → done() callback           │
└──────────────────────────────────────────────────────────┘
```

### Enter 动画时序（双线程）

```
BG Thread                          Main Thread
─────────                          ────────────
BaseTransition.beforeEnter(el)
  → SET_CLASS(id, 'fade-enter-from fade-enter-active')
  → SET_EVENT(id, 'bind', 'transitionend', sign)

BaseTransition calls insert(el)
  → INSERT(parent, child, anchor)

── ops flush ──────────────────────→ applyOps():
                                     __SetClasses(el, 'fade-enter-from fade-enter-active')
                                     __AddEvent(el, 'bind', 'transitionend', sign)
                                     __AppendElement(parent, child)
                                     __FlushElementTree()
                                     // Lynx layout & paint: el starts at enter-from state

── ack callback ──────────────────→ (flush complete)

BG: onFlushAck()
  → SET_CLASS(id, 'fade-enter-active fade-enter-to')
  → scheduleFlush()

── ops flush ──────────────────────→ applyOps():
                                     __SetClasses(el, 'fade-enter-active fade-enter-to')
                                     // CSS transition kicks in: animates from enter-from → enter-to

                                   ... animation plays ...

                                   transitionend event fires
                                   → publishEvent(sign, eventData) ───→ BG

BG: transitionend handler
  → SET_CLASS(id, '')  // remove all transition classes
  → call afterEnter hook
```

### Leave 动画时序

```
BG Thread                          Main Thread
─────────                          ────────────
BaseTransition.leave(el, remove)
  → SET_CLASS(id, 'fade-leave-from fade-leave-active')
  → SET_EVENT(id, 'bind', 'transitionend', sign)

── ops flush ──────────────────────→ applyOps():
                                     __SetClasses(el, 'fade-leave-from fade-leave-active')
                                     // Lynx layout: captures leave-from state

── ack ──────────────────────────→

BG: onFlushAck()
  → SET_CLASS(id, 'fade-leave-active fade-leave-to')

── ops flush ──────────────────────→ CSS transition: leave-from → leave-to

                                   transitionend → publishEvent → BG

BG: transitionend handler
  → remove()    // BaseTransition 调用 remove，触发 nodeOps.remove()
  → afterLeave hook
```

---

## Implementation Plan

### Phase 1: `<Transition>` — CSS class-based 动画

#### Step 1.1: `LynxTransition` 组件骨架

**文件**：`packages/vue/runtime/src/components/Transition.ts`

```typescript
import { BaseTransition, type BaseTransitionProps, h } from '@vue/runtime-core';
import type { ShadowElement } from '../shadow-element.js';

export interface TransitionProps extends BaseTransitionProps<ShadowElement> {
  name?: string;
  type?: 'transition' | 'animation';
  duration?: number | { enter: number; leave: number };
  enterFromClass?: string;
  enterActiveClass?: string;
  enterToClass?: string;
  leaveFromClass?: string;
  leaveActiveClass?: string;
  leaveToClass?: string;
  appearFromClass?: string;
  appearActiveClass?: string;
  appearToClass?: string;
}

export const Transition = /*#__PURE__*/ (props, { slots }) => {
  return h(BaseTransition, resolveTransitionProps(props), slots);
};
```

**关键函数**：`resolveTransitionProps(rawProps)` — 将 `name="fade"` 转换为 `onBeforeEnter` / `onEnter` / `onLeave` 等 hooks。

#### Step 1.2: Class 管理逻辑

**核心难点**：在 BG Thread 操作 ShadowElement 的 class。

当前 `nodeOps.patchProp` 的 `class` 分支直接 `pushOp(OP.SET_CLASS, el.id, nextValue)`。但 Transition 需要在**已有 class 的基础上追加/移除** transition classes。

**方案**：在 ShadowElement 上维护一个 `_classes: Set<string>` 字段：

```typescript
// shadow-element.ts 新增
_classes: Set<string> = new Set()
_baseClass: string = ''  // 用户通过 :class 设置的

// transition 用的 helper
addTransitionClass(cls: string): void
removeTransitionClass(cls: string): void
```

当 `patchProp(el, 'class', ...)` 被调用时，更新 `_baseClass`。Transition hooks 用 `addTransitionClass` / `removeTransitionClass` 操作 `_classes`。最终 class = `_baseClass + ' ' + [..._classes].join(' ')`。

每次 class 变化都 `pushOp(OP.SET_CLASS, el.id, computedClassString)`。

#### Step 1.3: `nextFrame` — 利用 flush ack 实现跨帧

DOM 版用双 rAF 确保浏览器渲染了 enter-from 状态后再切换到 enter-to。我们利用 **flush ack 回调**：

```typescript
function nextFrame(cb: () => void): void {
  // 方案 A: waitForFlush — 等待当前 ops batch 被 Main Thread 执行完毕
  // 此时 enter-from class 已经被应用，Lynx 已完成至少一次 layout
  waitForFlush().then(cb);

  // 方案 B: 如果 waitForFlush 粒度不够，可以引入新的 OP:
  //   OP.REQUEST_FRAME — Main Thread 收到后 rAF → callback 到 BG
  //   但这增加了协议复杂度，先用方案 A 验证
}
```

#### Step 1.4: `whenTransitionEnds` — 动画结束检测

两种策略，按优先级尝试：

**策略 A：事件监听（首选）**

通过现有事件系统绑定 `transitionend` / `animationend`：

```typescript
function onTransitionEnd(
  el: ShadowElement,
  expectedType: 'transition' | 'animation',
  cb: () => void,
) {
  const eventName = expectedType === 'transition'
    ? 'transitionend'
    : 'animationend';
  const sign = register((data) => {
    // 可选：检查 data.propertyName 是否匹配
    unregister(sign); // 一次性监听
    cb();
  });
  pushOp(OP.SET_EVENT, el.id, 'bindEvent', eventName, sign);
}
```

**策略 B：超时 fallback**

如果事件没有正确触发（例如没有实际 CSS transition 定义），用 `duration` prop 指定的时间做 `setTimeout` 兜底：

```typescript
if (props.duration) {
  setTimeout(done, normalizedDuration);
}
```

DOM 版通过 `getComputedStyle()` 检测元素上有没有 transition/animation 定义。我们在双线程下无法同步调用 `getComputedStyle()`，所以**必须依赖事件或 duration prop**。

#### Step 1.5: 完整的 `resolveTransitionProps` 实现

```typescript
function resolveTransitionProps(
  rawProps: TransitionProps,
): BaseTransitionProps<ShadowElement> {
  const name = rawProps.name || 'v';
  const {
    enterFromClass = `${name}-enter-from`,
    enterActiveClass = `${name}-enter-active`,
    enterToClass = `${name}-enter-to`,
    leaveFromClass = `${name}-leave-from`,
    leaveActiveClass = `${name}-leave-active`,
    leaveToClass = `${name}-leave-to`,
  } = rawProps;

  return {
    ...rawProps, // mode, appear, persisted, user hooks passthrough

    onBeforeEnter(el) {
      callHook(rawProps.onBeforeEnter, [el]);
      addTransitionClass(el, enterFromClass);
      addTransitionClass(el, enterActiveClass);
    },

    onEnter(el, done) {
      // 下一帧（flush ack 后）切换 class
      nextFrame(() => {
        removeTransitionClass(el, enterFromClass);
        addTransitionClass(el, enterToClass);

        if (!hasExplicitDuration(rawProps)) {
          // 监听 transitionend / animationend
          whenTransitionEnds(el, rawProps.type, done);
        } else {
          setTimeout(done, normalizeDuration(rawProps.duration).enter);
        }
      });
      callHook(rawProps.onEnter, [el, done]);
    },

    onAfterEnter(el) {
      removeTransitionClass(el, enterActiveClass);
      removeTransitionClass(el, enterToClass);
      callHook(rawProps.onAfterEnter, [el]);
    },

    onBeforeLeave(el) {
      callHook(rawProps.onBeforeLeave, [el]);
      addTransitionClass(el, leaveFromClass);
      addTransitionClass(el, leaveActiveClass);
    },

    onLeave(el, done) {
      nextFrame(() => {
        removeTransitionClass(el, leaveFromClass);
        addTransitionClass(el, leaveToClass);

        if (!hasExplicitDuration(rawProps)) {
          whenTransitionEnds(el, rawProps.type, done);
        } else {
          setTimeout(done, normalizeDuration(rawProps.duration).leave);
        }
      });
      callHook(rawProps.onLeave, [el, done]);
    },

    onAfterLeave(el) {
      removeTransitionClass(el, leaveActiveClass);
      removeTransitionClass(el, leaveToClass);
      callHook(rawProps.onAfterLeave, [el]);
    },

    onEnterCancelled(el) {
      removeTransitionClass(el, enterFromClass);
      removeTransitionClass(el, enterActiveClass);
      removeTransitionClass(el, enterToClass);
      callHook(rawProps.onEnterCancelled, [el]);
    },

    onLeaveCancelled(el) {
      removeTransitionClass(el, leaveFromClass);
      removeTransitionClass(el, leaveActiveClass);
      removeTransitionClass(el, leaveToClass);
      callHook(rawProps.onLeaveCancelled, [el]);
    },
  };
}
```

#### Step 1.6: 导出与注册

```typescript
// packages/vue/runtime/src/index.ts
export { Transition } from './components/Transition.js';
// 不 export BaseTransition（用户直接用 Transition）
```

Vue 的 SFC 模板编译器在遇到 `<Transition>` 时会 resolve 到 `_component_Transition`。我们需要确保 `Transition` 作为全局组件注册，或者在 module alias 中把 `vue` 指向我们的 runtime（已有此配置）。

---

### Phase 2: `<TransitionGroup>` — 列表动画

#### Step 2.1: 基础 enter/leave 动画

`TransitionGroup` 对**每个子元素**独立应用 enter/leave transition hooks。与 `Transition` 的主要区别：

- 渲染为一个真实容器元素（默认 `<view>`，可通过 `tag` prop 定制）
- 所有子元素必须有唯一 `key`
- 每个子元素独立挂 `TransitionHooks`

```typescript
// packages/vue/runtime/src/components/TransitionGroup.ts
import { TransitionGroup as BaseTransitionGroup } from '@vue/runtime-core';

export const TransitionGroup = defineComponent({
  name: 'TransitionGroup',
  props: {
    tag: { type: String, default: 'view' },
    // ... same props as Transition (name, duration, classes, etc.)
  },
  setup(props, { slots }) {
    // 为每个子 VNode 应用 resolveTransitionHooks
    // render 时包裹在 h(props.tag, ...) 中
  },
});
```

#### Step 2.2: Move 动画（Phase 2b — 待 DOM Query API 就绪）

Move 动画（列表项重排时的 FLIP 动画）需要：

1. 在 patch 前读取每个元素的 bounding rect（`positionMap`）
2. patch 后再读取新位置（`newPositionMap`）
3. 计算 delta，用 `transform: translate(dx, dy)` 做动画

**双线程挑战**：`getBoundingClientRect()` 在 Main Thread，BG 无法同步调用。

**可选方案**：

| 方案                      | 描述                                                       | 复杂度              |
| ------------------------- | ---------------------------------------------------------- | ------------------- |
| **A. 新 OP: QUERY_RECT**  | BG 发 QUERY_RECT ops 到 MT，MT 读取 rect 后 callback 回 BG | 中 — 需要 async ops |
| **B. Main Thread Script** | move 计算整个放到 Main Thread，用 worklet 执行 FLIP        | 高 — 但性能最好     |
| **C. 不做 move**          | 只支持 enter/leave，不支持 move                            | 低 — 但功能不完整   |

**建议**：Phase 1 先走 **方案 C**（不做 move），Phase 2b 实现 **方案 A**（QUERY_RECT + async callback）。

---

### Phase 3: 验证与测试

#### Step 3.1: 单元测试

**文件**：`packages/vue/runtime/__tests__/transition.test.ts`

可以在纯 BG Thread 环境下验证 ops 序列：

```typescript
describe('Transition', () => {
  it('emits correct ops sequence for enter', async () => {
    const App = defineComponent({
      setup() {
        const show = ref(false)
        return { show }
      },
      render() {
        return h(Transition, { name: 'fade' }, {
          default: () => this.show ? h('view', { key: 'content' }, 'Hello') : null
        })
      }
    })

    const app = createApp(App)
    app.mount()
    let ops = takeOps()
    // Initial: nothing rendered (show=false)

    // Trigger enter
    app._instance.setupState.show = true
    await nextTick()
    ops = takeOps()

    // Expect: CREATE, SET_CLASS('fade-enter-from fade-enter-active'), INSERT
    expect(ops).toContainOp(OP.SET_CLASS, expect.any(Number), 'fade-enter-from fade-enter-active')
    expect(ops).toContainOp(OP.INSERT, ...)

    // After flush ack: SET_CLASS('fade-enter-active fade-enter-to')
    // After transitionend: SET_CLASS('') + afterEnter
  })

  it('emits correct ops for leave', ...)
  it('supports out-in mode', ...)
  it('supports appear', ...)
  it('cancels enter when leave starts', ...)
  it('explicit duration uses setTimeout', ...)
})
```

#### Step 3.2: E2E Demo

**文件**：`packages/vue/e2e-lynx/src/transition-demo/`

```vue
<template>
  <view>
    <view bindtap="toggle">Toggle</view>
    <Transition name="fade">
      <view v-if="show" class="box">Hello Transition!</view>
    </Transition>
  </view>
</template>

<script setup>
import { ref } from '@lynx-js/vue-runtime';
const show = ref(true);
const toggle = () => {
  show.value = !show.value;
};
</script>

<style>
.fade-enter-active, .fade-leave-active {
  transition-property: opacity;
  transition-duration: 300ms;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
```

#### Step 3.3: TransitionGroup Demo

```vue
<template>
  <view>
    <view bindtap="add">Add Item</view>
    <TransitionGroup name="list" tag="view">
      <view v-for="item in items" :key="item" class="item">
        {{ item }}
      </view>
    </TransitionGroup>
  </view>
</template>

<style>
.list-enter-active, .list-leave-active {
  transition-property: opacity, transform;
  transition-duration: 300ms;
}
.list-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
```

---

## Risk Assessment

| 风险                                                                                                      | 影响                          | 缓解                                                  |
| --------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| `waitForFlush` 作为 `nextFrame` 粒度不够 — enter-from 和 enter-to 可能在同一个 Lynx layout cycle 中被合并 | 动画不播放                    | 引入 `OP.REQUEST_FRAME`，让 MT 做一次 rAF 后 callback |
| `transitionend` 事件不触发（如果元素没有 CSS transition 定义）                                            | leave 动画后元素不被移除      | 始终设置 `duration` prop 或实现超时 fallback          |
| `__SetClasses` 的行为是 replace（不是 add/remove）                                                        | 需要在 BG 维护完整 class 状态 | ShadowElement 上维护 `_classes` + `_baseClass`        |
| TransitionGroup 的 move 动画需要 bounding rect 查询                                                       | Phase 1 无法实现 move         | 分阶段，先 enter/leave                                |

## Dependencies

- `@vue/runtime-core` 的 `BaseTransition`、`resolveTransitionHooks`（已有）
- 现有 ops 协议（`SET_CLASS`, `SET_EVENT`）— 无需新 op code
- `waitForFlush()` — 已有
- `register()` / `unregister()` 事件注册 — 已有
- Lynx CSS transition/animation 引擎 — 平台能力

## Deliverables

| Phase        | 交付物                                                          | 估计改动量      |
| ------------ | --------------------------------------------------------------- | --------------- |
| **Phase 1**  | `Transition` 组件 + class 管理 + nextFrame + whenTransitionEnds | ~300 行新代码   |
| **Phase 2a** | `TransitionGroup` (enter/leave only)                            | ~150 行新代码   |
| **Phase 2b** | `TransitionGroup` move 动画 (QUERY_RECT)                        | ~200 行 + 新 OP |
| **Phase 3**  | 单元测试 + E2E demo                                             | ~400 行测试     |

## Open Questions

1. **`__SetClasses` 语义**：当前 ops-apply.ts 调用 `__SetClasses(el, cls)` — 这是完全替换还是追加？如果是替换，BG 端必须管理完整 class 字符串。→ 从代码看是替换，需要 BG 管理。

2. **Lynx 的 `transitionend` 事件数据格式**：是否包含 `propertyName`？这影响我们能否精确判断哪个属性的 transition 完成了。如果不包含，需要做 counter-based 方案（计算有几个属性在过渡）。

3. **CSS Scope 与 Transition Classes**：Lynx 的 `__SetCSSId` 设置了 CSS scope 0。transition 相关的 class（如 `.fade-enter-active`）的 CSS 规则需要定义在全局 scope 或 scope 0 中，否则选择器无法匹配。需要确认 SFC 的 `<style>` 在 Lynx 中的 scope 行为。

4. **`appear` 的时机**：首次挂载时 BaseTransition 会检查 `isMounted`。在双线程下，首次 mount 的 ops flush 和后续的 enter 动画 class 切换是否需要特殊处理？
