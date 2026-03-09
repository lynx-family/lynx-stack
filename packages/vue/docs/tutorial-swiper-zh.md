# 教程：商品详情页

本教程将指导你使用 **Vue 3** 和 **Lynx** 逐步构建一个高性能的商品详情页面，核心是一个支持手势滑动的图片轮播组件。

在本教程中，你将学习：

- [**构建静态布局**](#构建静态布局)：使用 `v-for` 和 Lynx `display: linear` 创建横向滚动结构
- [**监听触摸事件**](#监听触摸事件)：在背景线程处理触摸事件并更新节点样式
- [**使用主线程脚本减少延迟**](#使用主线程脚本减少延迟)：通过 `'main thread'` 指令消除跨线程往返延迟
- [**用组合式函数整理代码**](#用组合式函数整理代码)：将触摸逻辑和样式更新提取到可复用的 composable 中
- [**添加滑动吸附动画**](#添加滑动吸附动画)：基于 `requestAnimationFrame` 的主线程动画
- [**主线程与背景线程通信**](#主线程与背景线程通信)：使用 `runOnBackground` 和 `runOnMainThread` 跨线程调用函数
- [**跨线程传值**](#跨线程传值)：在线程间传递数值参数和主线程函数

## 我们要构建什么？

最终效果是一个商品详情页面。顶部有一个全屏宽度的图片轮播组件：

- 手指拖拽可平滑滑动浏览图片，**零延迟**
- 松手后自动**吸附到最近的页面**，带缓动动画
- 底部**指示器**实时高亮当前页
- **点击指示器**可跳转到对应页面

<!-- 最终效果入口：Swiper/index.ts -->

## 准备工作

本教程假设你已经完成了 [快速开始](https://lynxjs.org/next/guide/start/quick-start.html) 中的环境搭建，并且安装了 LynxExplorer App。

本教程的所有代码位于 `packages/vue/e2e-lynx/src/swiper/` 目录下，包含三个渐进式入口：

| 入口          | 说明                               | 对应章节                                  |
| ------------- | ---------------------------------- | ----------------------------------------- |
| `SwiperEmpty` | 静态布局，无交互                   | [构建静态布局](#构建静态布局)             |
| `SwiperMTS`   | 主线程触摸处理，无动画/指示器      | [使用主线程脚本](#使用主线程脚本减少延迟) |
| `Swiper`      | 完整版：动画 + 指示器 + 跨线程通信 | [添加动画](#添加滑动吸附动画) 及之后      |

推荐使用 TypeScript，以获得更好的编辑器提示和类型检查。

## 构建静态布局

先从最简单的开始 —— 一个不可交互的静态图片列表。

### 创建 SwiperItem 组件

每张图片用一个 `SwiperItem` 组件包裹：

```vue title="Components/SwiperItem.vue"
<script setup lang="ts">
defineProps<{
  pic: string;
  itemWidth: number;
}>();
</script>

<template>
  <view :style="{ width: itemWidth + 'px', height: '100%' }">
    <image
      mode="aspectFill"
      :src="pic"
      :style="{ width: '100%', height: '100%' }"
    />
  </view>
</template>
```

### 创建 Swiper 组件

用 `v-for` 渲染图片列表，容器使用 Lynx 的 `display: linear` 横向布局：

```vue title="SwiperEmpty/Swiper.vue"
<script setup lang="ts">
import SwiperItem from '../Components/SwiperItem.vue';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(
  defineProps<{
    data: string[];
    itemWidth?: number;
  }>(),
  {
    itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
  },
);
</script>

<template>
  <view class="swiper-wrapper">
    <view class="swiper-container">
      <SwiperItem
        v-for="(pic, index) in data"
        :key="index"
        :pic="pic"
        :item-width="props.itemWidth"
      />
    </view>
  </view>
</template>
```

关键样式 —— `display: linear` 是 Lynx 特有的线性布局，类似 flexbox 但更高效：

```css title="swiper.css"
.swiper-wrapper {
  flex: 1;
  width: 100%;
}
.swiper-container {
  display: linear;
  linear-orientation: horizontal;
  height: 100%;
}
```

::: info Lynx 的 display: linear
Lynx 支持 `display: linear` 布局模式，其中 `linear-orientation: horizontal` 会将子元素横向排列。与 `display: flex` 相比，`linear` 布局在 Lynx 的原生渲染引擎中有更好的性能。
:::

### 创建入口

```ts title="SwiperEmpty/index.ts"
import { createApp, defineComponent, h } from '@lynx-js/vue-runtime';
import '../swiper.css';
import Swiper from './Swiper.vue';
import Page from '../Components/Page.vue';
import { picsArr } from '../utils/pics.js';

const App = defineComponent({
  setup() {
    return () =>
      h(Page, null, {
        default: () => h(Swiper, { data: picsArr }),
      });
  },
});

createApp(App).mount();
```

此时打开 LynxExplorer 预览 SwiperEmpty，你会看到一排图片横向排列，但无法滑动。接下来我们加上触摸交互。

## 监听触摸事件

要让图片可以左右滑动，我们需要：

1. 监听 `touchstart` / `touchmove` / `touchend` 事件
2. 计算手指的位移量
3. 将位移量应用到容器的 `transform` 样式上

### 背景线程的方案

在 Vue Lynx 中，事件处理函数默认运行在**背景线程** (Background Thread)。我们可以用普通的 Vue `ref` 来记录触摸状态：

```vue title="Swiper.vue（背景线程方案）" {3,6-8,11-13,16-19,22-23}
<script setup lang="ts">
import { ref } from 'vue';
import SwiperItem from '../Components/SwiperItem.vue';

// 触摸状态
const touchStartX = ref(0);
const currentOffset = ref(0);
const touchStartOffset = ref(0);

function handleTouchStart(
  e: { detail: { touches: Array<{ clientX: number }> } },
) {
  touchStartX.value = e.detail.touches[0].clientX;
  touchStartOffset.value = currentOffset.value;
}

function handleTouchMove(
  e: { detail: { touches: Array<{ clientX: number }> } },
) {
  const delta = e.detail.touches[0].clientX - touchStartX.value;
  currentOffset.value = touchStartOffset.value + delta;
  // 需要更新样式... 怎么做？
}
</script>

<template>
  <view class="swiper-wrapper">
    <view
      class="swiper-container"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
    >
      <!-- ... -->
    </view>
  </view>
</template>
```

但这里有个问题 —— 在背景线程中，我们**没有直接访问 DOM 节点的能力**。要更新容器的 `transform` 样式，需要通过类似 `lynx.createSelectorQuery()` 的异步 API 发起一次**跨线程往返**。

::: details 为什么不用响应式状态来更新位置？
你可能会想：用 `:style="{ transform: 'translateX(' + currentOffset + 'px)' }"` 绑定不就行了？

这样做**可以工作**，但每次 `touchmove`（每秒可触发 60~120 次）都会触发 Vue 的响应式更新 → diff → 生成 ops → 跨线程发送 → 主线程应用。这个完整的更新链路会带来明显的延迟，在低端设备上尤为严重。

对于高频触摸事件，我们需要一种更直接的方式来更新样式。
:::

### 延迟问题

在 Lynx 的双线程架构中，触摸事件的默认处理流程是：

```
┌──────────────┐    触摸事件     ┌──────────────┐    更新样式     ┌──────────────┐
│   Native     │ ──────────────▶ │  背景线程     │ ──────────────▶ │   主线程     │
│  (触摸发生)   │                 │ (事件处理)    │   跨线程调用     │  (应用样式)   │
└──────────────┘                 └──────────────┘                 └──────────────┘
```

每次触摸移动都需要经历 **主线程 → 背景线程 → 主线程** 的完整往返，这在低端设备上会造成可感知的**滑动延迟**。

解决方案？**让事件处理函数直接运行在主线程上。**

## 使用主线程脚本减少延迟

[主线程脚本 (Main Thread Script)](https://lynxjs.org/next/guide/interaction/main-thread-script/quick-start.html) 允许我们将函数标记为在主线程上运行，完全消除跨线程往返延迟。

### 三个关键变化

将背景线程方案改为主线程方案，只需要三步：

**1. 用 `useMainThreadRef` 替代 `ref`**

主线程函数不能访问背景线程的 `ref()`。改用 `useMainThreadRef`，它创建的引用在主线程上可读写：

```ts {1,4-7}
import { useMainThreadRef } from '@lynx-js/vue-runtime';

// 之前: const touchStartX = ref(0);
const containerRef = useMainThreadRef<unknown>(null);
const currentOffsetRef = useMainThreadRef<number>(0);
const touchStartXRef = useMainThreadRef<number>(0);
const touchStartOffsetRef = useMainThreadRef<number>(0);
```

::: info useMainThreadRef 的访问方式
`useMainThreadRef` 返回的引用在主线程上通过 `.current` 属性访问（不是 Vue 的 `.value`）。这是因为主线程运行时使用 `.current` 作为统一的访问协议，和 React 的 `useRef` 保持一致。

```ts
// 背景线程：Vue ref
const count = ref(0);
count.value = 1;

// 主线程：MainThreadRef
const countRef = useMainThreadRef<number>(0);
// 在 'main thread' 函数中：
countRef.current = 1;
```

:::

**2. 给函数添加 `'main thread'` 指令**

在函数体的第一行加上字符串字面量 `'main thread'`，SWC 编译器会自动将这个函数提取到主线程 bundle 中运行：

```ts {2,8,14}
const handleTouchStart = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  touchStartXRef.current = e.touches[0].clientX;
  touchStartOffsetRef.current = currentOffsetRef.current;
};

const handleTouchMove = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  const delta = e.touches[0].clientX - touchStartXRef.current;
  const offset = touchStartOffsetRef.current + delta;
  currentOffsetRef.current = offset;
  // 直接操作主线程节点的样式
  (containerRef as any).current?.setStyleProperties?.({
    transform: `translateX(${offset}px)`,
  });
};

const handleTouchEnd = () => {
  'main thread';
  touchStartXRef.current = 0;
  touchStartOffsetRef.current = 0;
};
```

**3. 模板中使用 `main-thread-` 前缀**

Vue Lynx 使用 `main-thread-` 前缀将事件绑定和 ref 路由到主线程：

```vue {3-6}
<template>
  <view
    class="swiper-container"
    :main-thread-ref="containerRef"
    :main-thread-bindtouchstart="handleTouchStart"
    :main-thread-bindtouchmove="handleTouchMove"
    :main-thread-bindtouchend="handleTouchEnd"
  >
    <!-- ... -->
  </view>
</template>
```

::: details Vue 与 React 的属性前缀差异
React Lynx 使用冒号分隔的属性名（`main-thread:ref`, `main-thread:bindtouchstart`），因为 JSX 支持这种写法。

Vue 模板不支持属性名中的冒号，所以使用 `main-thread-` 连字符前缀配合 `v-bind` (`:`)：

```vue
<!-- React Lynx -->
<view main-thread:ref="{containerRef}" main-thread:bindtouchstart="{fn}" />

<!-- Vue Lynx -->
<view :main-thread-ref="containerRef" :main-thread-bindtouchstart="fn" />
```

效果完全相同，只是语法适配了 Vue 模板。
:::

### 完整的 SwiperMTS 组件

将上述改动合并，得到完整的主线程触摸处理版本：

```vue title="SwiperMTS/Swiper.vue"
<script setup lang="ts">
import { useMainThreadRef } from '@lynx-js/vue-runtime';
import SwiperItem from '../Components/SwiperItem.vue';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(
  defineProps<{
    data: string[];
    itemWidth?: number;
  }>(),
  {
    itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
  },
);

const containerRef = useMainThreadRef<unknown>(null);
const currentOffsetRef = useMainThreadRef<number>(0);
const touchStartXRef = useMainThreadRef<number>(0);
const touchStartOffsetRef = useMainThreadRef<number>(0);

const handleTouchStart = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  touchStartXRef.current = e.touches[0].clientX;
  touchStartOffsetRef.current = currentOffsetRef.current;
};

const handleTouchMove = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  const delta = e.touches[0].clientX - touchStartXRef.current;
  const offset = touchStartOffsetRef.current + delta;
  currentOffsetRef.current = offset;
  (containerRef as any).current?.setStyleProperties?.({
    transform: `translateX(${offset}px)`,
  });
};

const handleTouchEnd = () => {
  'main thread';
  touchStartXRef.current = 0;
  touchStartOffsetRef.current = 0;
};
</script>

<template>
  <view class="swiper-wrapper">
    <view
      class="swiper-container"
      :main-thread-ref="containerRef"
      :main-thread-bindtouchstart="handleTouchStart"
      :main-thread-bindtouchmove="handleTouchMove"
      :main-thread-bindtouchend="handleTouchEnd"
    >
      <SwiperItem
        v-for="(pic, index) in data"
        :key="index"
        :pic="pic"
        :item-width="props.itemWidth"
      />
    </view>
  </view>
</template>
```

打开 LynxExplorer 预览 SwiperMTS —— 手指拖拽图片，你会发现滑动**即时响应**，没有任何延迟。

::: details 谨慎使用主线程脚本
只在遇到**高频事件延迟问题**时才使用主线程脚本。过度使用会增加主线程负担，反而导致卡顿。

适合的场景：

- `touchmove`、`scroll` 等高频触摸/滚动事件
- 需要即时响应的拖拽交互
- 动画帧更新

不适合的场景：

- 简单的 `tap` 点击处理
- 不频繁的 UI 更新
- 需要复杂数据处理的逻辑
  :::

## 用组合式函数整理代码

目前所有逻辑都在一个组件里。随着功能增加（动画、指示器），代码会变得难以维护。Vue 3 的[组合式函数 (Composables)](https://vuejs.org/guide/reusability/composables.html) 可以帮我们整理代码 —— 相当于 React 中的自定义 Hooks。

### useUpdateSwiperStyle —— 容器引用与样式更新

将 `containerRef` 和样式更新逻辑提取出来：

```ts title="Swiper/useUpdateSwiperStyle.ts"
import { useMainThreadRef } from '@lynx-js/vue-runtime';

export function useUpdateSwiperStyle() {
  const containerRef = useMainThreadRef<unknown>(null);

  function updateSwiperStyle(offset: number) {
    'main thread';
    (
      containerRef as unknown as {
        current?: { setStyleProperties?(s: Record<string, string>): void };
      }
    ).current?.setStyleProperties?.({
      transform: `translateX(${offset}px)`,
    });
  }

  return {
    containerRef,
    updateSwiperStyle,
  };
}
```

### useOffset —— 触摸处理与偏移量跟踪

触摸事件的核心逻辑提取到 `useOffset`，接收回调函数来解耦：

```ts title="Swiper/useOffset.ts"
import { useMainThreadRef } from '@lynx-js/vue-runtime';

export function useOffset({
  onOffsetUpdate,
  itemWidth,
}: {
  onOffsetUpdate: (offset: number) => void;
  itemWidth: number;
}) {
  const touchStartXRef = useMainThreadRef<number>(0);
  const touchStartCurrentOffsetRef = useMainThreadRef<number>(0);
  const currentOffsetRef = useMainThreadRef<number>(0);

  function updateOffset(offset: number) {
    'main thread';
    currentOffsetRef.current = offset;
    onOffsetUpdate(offset);
  }

  function handleTouchStart(e: { touches: Array<{ clientX: number }> }) {
    'main thread';
    touchStartXRef.current = e.touches[0].clientX;
    touchStartCurrentOffsetRef.current = currentOffsetRef.current;
  }

  function handleTouchMove(e: { touches: Array<{ clientX: number }> }) {
    'main thread';
    const touchMoveX = e.touches[0].clientX;
    const deltaX = touchMoveX - touchStartXRef.current;
    updateOffset(touchStartCurrentOffsetRef.current + deltaX);
  }

  function handleTouchEnd() {
    'main thread';
    touchStartXRef.current = 0;
    touchStartCurrentOffsetRef.current = 0;
  }

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
```

### 简化后的 Swiper.vue

组件变成了薄薄的组装层：

```vue title="Swiper/Swiper.vue"
<script setup lang="ts">
import SwiperItem from '../Components/SwiperItem.vue';
import { useOffset } from './useOffset';
import { useUpdateSwiperStyle } from './useUpdateSwiperStyle';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(
  defineProps<{
    data: string[];
    itemWidth?: number;
  }>(),
  {
    itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
  },
);

const { containerRef, updateSwiperStyle } = useUpdateSwiperStyle();
const { handleTouchStart, handleTouchMove, handleTouchEnd } = useOffset({
  itemWidth: props.itemWidth,
  onOffsetUpdate: updateSwiperStyle,
});
</script>

<template>
  <view class="swiper-wrapper">
    <view
      class="swiper-container"
      :main-thread-ref="containerRef"
      :main-thread-bindtouchstart="handleTouchStart"
      :main-thread-bindtouchmove="handleTouchMove"
      :main-thread-bindtouchend="handleTouchEnd"
    >
      <SwiperItem
        v-for="(pic, index) in data"
        :key="index"
        :pic="pic"
        :item-width="itemWidth"
      />
    </view>
  </view>
</template>
```

::: info 组合式函数 vs React Hooks
Vue 组合式函数和 React Hooks 有相同的目标 —— 逻辑复用和关注点分离。但 Vue 的版本更灵活：

- **没有调用规则限制**：不需要遵守 "Rules of Hooks"，可以在任何地方调用
- **天然的闭包复用**：`'main thread'` 标记的函数通过闭包捕获 `useMainThreadRef` 的引用，和普通函数一样自然

两个框架的主线程脚本函数体**完全相同** —— `'main thread'` 指令是框架无关的。
:::

目前滑动松手后图片会停在任意位置。接下来我们添加吸附动画。

## 添加滑动吸附动画

松手后，图片应该自动滑到最近的一整页位置。这需要一个基于 `requestAnimationFrame` 的主线程动画。

### useAnimate —— RAF 动画组合式函数

```ts title="utils/useAnimate.ts"
import { useMainThreadRef } from '@lynx-js/vue-runtime';

export interface AnimationOptions {
  from: number;
  to: number;
  duration?: number;
  delay?: number;
  easing?: (t: number) => number;
  onUpdate?: (value: number) => void;
  onComplete?: () => void;
}

export const easings = {
  easeInOutQuad: (t: number) => {
    'main thread';
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },
};

function animateInner(options: AnimationOptions) {
  'main thread';
  const {
    from,
    to,
    duration = 5000,
    delay = 0,
    easing = easings.easeInOutQuad,
    onUpdate,
    onComplete,
  } = options;

  let startTs = 0;
  let rafId = 0;

  function tick(ts: number) {
    const progress =
      Math.max(Math.min(((ts - startTs - delay) * 100) / duration, 100), 0)
      / 100;
    const easedProgress = easing(progress);
    const currentValue = from + (to - from) * easedProgress;
    onUpdate?.(currentValue);
  }

  function step(ts: number) {
    if (!startTs) startTs = Number(ts);
    if (ts - startTs <= duration + 100) {
      tick(ts);
      rafId = requestAnimationFrame(step);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(step);

  return { cancel: () => cancelAnimationFrame(rafId) };
}

export function useAnimate() {
  const lastCancelRef = useMainThreadRef<(() => void) | null>(null);

  function cancel() {
    'main thread';
    lastCancelRef.current?.();
  }

  function animate(options: AnimationOptions) {
    'main thread';
    cancel();
    const { cancel: innerCancel } = animateInner(options);
    lastCancelRef.current = innerCancel;
  }

  return { cancel, animate };
}
```

注意：`easing` 函数也需要 `'main thread'` 指令，因为它会在主线程的 `animateInner` 中被调用。

### 更新 useOffset —— 添加吸附逻辑

在 `handleTouchEnd` 中计算最近的页面位置，并启动动画：

```ts title="Swiper/useOffset.ts" {5,14-15,18-21,33-43}
import { useMainThreadRef } from '@lynx-js/vue-runtime';
import { useAnimate } from '../utils/useAnimate';

export function useOffset({
  onOffsetUpdate,
  itemWidth,
  dataLength,
}: {
  onOffsetUpdate: (offset: number) => void;
  itemWidth: number;
  dataLength: number;
}) {
  const touchStartXRef = useMainThreadRef<number>(0);
  const touchStartCurrentOffsetRef = useMainThreadRef<number>(0);
  const currentOffsetRef = useMainThreadRef<number>(0);
  // 新增：动画 composable
  const { animate, cancel: cancelAnimate } = useAnimate();

  // 新增：计算最近的整页偏移量
  function calcNearestPage(offset: number) {
    'main thread';
    const nearestPage = Math.round(offset / itemWidth);
    return nearestPage * itemWidth;
  }

  function updateOffset(offset: number) {
    'main thread';
    // 新增：限制边界
    const lowerBound = 0;
    const upperBound = -(dataLength - 1) * itemWidth;
    const realOffset = Math.min(lowerBound, Math.max(upperBound, offset));
    currentOffsetRef.current = realOffset;
    onOffsetUpdate(realOffset);
  }

  function handleTouchStart(e: { touches: Array<{ clientX: number }> }) {
    'main thread';
    touchStartXRef.current = e.touches[0].clientX;
    touchStartCurrentOffsetRef.current = currentOffsetRef.current;
    cancelAnimate(); // 新增：触摸开始时取消正在进行的动画
  }

  // handleTouchMove 不变...

  function handleTouchEnd() {
    'main thread';
    touchStartXRef.current = 0;
    touchStartCurrentOffsetRef.current = 0;
    // 新增：松手后动画到最近的页面
    animate({
      from: currentOffsetRef.current,
      to: calcNearestPage(currentOffsetRef.current),
      onUpdate: (offset: number) => {
        'main thread';
        updateOffset(offset);
      },
    });
  }

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}
```

现在松手后图片会自动滑到最近的页面，带有平滑的缓动效果。

但是 —— 我们还没有页面指示器，用户不知道当前在第几页。添加指示器需要一个关键能力：**从主线程通知背景线程**。

## 主线程与背景线程通信

指示器（Indicator）组件是普通的 Vue 组件，运行在背景线程上，用响应式 `ref` 驱动。但当前页码的变化发生在主线程的 `handleTouchMove` 中。

我们需要一种方式让**主线程函数调用背景线程函数**。

::: info 主线程和背景线程的函数不能直接互相调用
主线程脚本和背景线程脚本运行在**完全独立的运行时环境**中。一个运行时中的函数无法直接调用另一个运行时中的函数，需要通过专用的桥接 API 通信：

- `runOnBackground(fn)` —— 在主线程函数中调用，异步执行背景线程的 `fn`
- `runOnMainThread(fn)` —— 在背景线程中调用，异步执行主线程函数 `fn`
  :::

### 主线程调用背景线程 —— `runOnBackground`

当用户拖拽图片时，`updateOffset` 在主线程计算出当前页码。我们需要将这个页码同步给背景线程的指示器状态：

```ts title="Swiper/useOffset.ts" {1,8,10,23-27}
import { runOnBackground, useMainThreadRef } from '@lynx-js/vue-runtime';

export function useOffset({
  onOffsetUpdate,
  onIndexUpdate, // 新增：背景线程的页码更新回调
  itemWidth,
  dataLength,
}: {
  onOffsetUpdate: (offset: number) => void;
  onIndexUpdate: (index: number) => void;
  itemWidth: number;
  dataLength: number;
}) {
  // ...
  const currentIndexRef = useMainThreadRef<number>(0);

  function updateOffset(offset: number) {
    'main thread';
    // ...（边界限制和样式更新不变）
    const index = Math.round(-realOffset / itemWidth);
    if (currentIndexRef.current !== index) {
      currentIndexRef.current = index;
      runOnBackground(onIndexUpdate)(index); // 🔑 MT → BG
    }
  }
  // ...
}
```

`runOnBackground(onIndexUpdate)(index)` 的含义是：**在背景线程上**异步调用 `onIndexUpdate` 函数，传入 `index` 参数。

::: details 为什么不直接调用 onIndexUpdate(index)？
如果你尝试在 `'main thread'` 函数中直接调用 `onIndexUpdate(index)`，SWC 编译器会报错。因为 `onIndexUpdate`（即 `setCurrent`）是背景线程的函数，在主线程运行时中**根本不存在**。

```ts
function updateOffset(offset: number) {
  'main thread';
  // ❌ 错误！onIndexUpdate 是背景线程函数
  onIndexUpdate(index);

  // ✅ 正确！通过 runOnBackground 桥接
  runOnBackground(onIndexUpdate)(index);
}
```

:::

### 背景线程调用主线程 —— `runOnMainThread`

指示器的点击需要跳转到对应页面。点击处理在背景线程，但滑动动画在主线程。这需要**背景线程调用主线程**：

```ts title="Swiper/useOffset.ts" {1-2,5-8}
import {
  runOnBackground,
  runOnMainThread,
  useMainThreadRef,
} from '@lynx-js/vue-runtime';

// 新增：背景线程函数，被 Indicator 的点击回调调用
function updateIndex(index: number) {
  const offset = -index * itemWidth;
  runOnMainThread(updateOffset)(offset); // 🔑 BG → MT
}
```

`runOnMainThread(updateOffset)(offset)` 的含义是：**在主线程上**异步调用 `updateOffset` 函数，传入 `offset` 参数。这样就能从背景线程触发主线程的样式更新。

### 添加 Indicator 组件

```vue title="Components/Indicator.vue"
<script setup lang="ts">
defineProps<{
  total: number;
  current: number;
}>();

const emit = defineEmits<{
  'item-click': [index: number];
}>();
</script>

<template>
  <view class="indicator">
    <view
      v-for="(_, index) in total"
      :key="index"
      :class="['indicator-item', index === current ? 'active' : '']"
      @tap="emit('item-click', index)"
    />
  </view>
</template>
```

### 在 Swiper 中组装

```vue title="Swiper/Swiper.vue" {2,5,8,15-17,23-24,30-34}
<script setup lang="ts">
import { ref } from 'vue';
import SwiperItem from '../Components/SwiperItem.vue';
import Indicator from '../Components/Indicator.vue';
import { useOffset } from './useOffset';
import { useUpdateSwiperStyle } from './useUpdateSwiperStyle';

const currentIndex = ref(0);

const { containerRef, updateSwiperStyle } = useUpdateSwiperStyle();
const { handleTouchStart, handleTouchMove, handleTouchEnd, updateIndex } =
  useOffset({
    itemWidth: props.itemWidth,
    dataLength: props.data.length,
    onIndexUpdate: (index: number) => {
      currentIndex.value = index; // BG 线程上更新响应式状态
    },
    onOffsetUpdate: updateSwiperStyle,
  });

function handleItemClick(index: number) {
  currentIndex.value = index;
  updateIndex(index); // BG → MT 跳转动画
}
</script>

<template>
  <view class="swiper-wrapper">
    <view class="swiper-container" ...>
      <!-- SwiperItem v-for 不变 -->
    </view>
    <Indicator
      :total="data.length"
      :current="currentIndex"
      @item-click="handleItemClick"
    />
  </view>
</template>
```

现在指示器会实时跟踪滑动进度，点击指示器也能跳转页面。数据流如下：

```
拖拽滑动（MT）:
  handleTouchMove → updateOffset → runOnBackground(onIndexUpdate) → currentIndex.value
                                                                          ↓
                                                                     Indicator 更新

点击跳转（BG → MT）:
  handleItemClick → updateIndex → runOnMainThread(updateOffset) → 动画滑动
```

## 跨线程传值

目前动画的时长和缓动曲线是硬编码的。我们想让它们从组件 props 传入。但这涉及一个微妙的问题：**主线程函数如何使用背景线程的值？**

### 主线程函数使用背景线程的值

`duration`（动画时长）是一个普通的 number 值，定义在背景线程的 props 中。主线程的 `handleTouchEnd` 函数需要用到它。

好消息是，**主线程函数可以自动捕获背景线程的值**。当 `useOffset` 接收到 `duration` 参数，闭包在函数中引用它，SWC 编译器会在组件渲染时自动将这些值序列化传递给主线程：

```ts title="Swiper/useOffset.ts" {5,14}
export function useOffset({
  onOffsetUpdate,
  onIndexUpdate,
  itemWidth,
  dataLength,
  duration, // 背景线程的值
}: {
  // ...
  duration?: number;
}) {
  // ...
  function handleTouchEnd() {
    'main thread';
    animate({
      // ...
      duration, // ✅ 自动从 BG 传入 MT
    });
  }
}
```

::: info 自动传值的限制
主线程函数捕获的背景线程值必须是**可序列化的**（number、string、boolean、plain object、array）。函数和 Promise 不能直接传递。

此外，值传递发生在**组件渲染时**，后续更新不会自动同步。对于不变的配置值（如 `duration`），这完全足够。
:::

### 背景线程传递主线程函数

缓动曲线（easing）是一个**函数**，需要在主线程的 RAF 循环中调用。普通函数不能跨线程传递——但标记了 `'main thread'` 的函数可以。

定义缓动函数时加上 `'main thread'` 指令：

```ts title="Swiper/index.ts" {2,9}
import { easings } from '../utils/useAnimate.js';

const App = defineComponent({
  setup() {
    return () =>
      h(Swiper, {
        data: picsArr,
        duration: 300,
        'main-thread-easing': easings.easeInOutQuad,
      });
  },
});
```

在 Swiper 组件中接收并传递：

```vue title="Swiper/Swiper.vue" {5,14}
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    data: string[];
    itemWidth?: number;
    duration?: number;
    'main-thread-easing'?: (t: number) => number;
  }>(),
  {
    itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
    duration: 300,
  },
);

const { handleTouchStart, handleTouchMove, handleTouchEnd, updateIndex } =
  useOffset({
    // ...
    duration: props.duration,
    MTEasing: props['main-thread-easing'],
  });
</script>
```

在 `useOffset` 中使用：

```ts title="Swiper/useOffset.ts" {7,17}
export function useOffset({
  // ...
  duration,
  MTEasing,
}: {
  // ...
  duration?: number;
  MTEasing?: (t: number) => number;
}) {
  function handleTouchEnd() {
    'main thread';
    animate({
      from: currentOffsetRef.current,
      to: calcNearestPage(currentOffsetRef.current),
      onUpdate: (offset: number) => {
        'main thread';
        updateOffset(offset);
      },
      duration, // BG value → MT
      easing: MTEasing, // MT function → MT
    });
  }
}
```

::: details 为什么使用 main-thread-easing 前缀？
当一个 prop 的值是**主线程函数**时，需要用 `main-thread-` 前缀命名（在 React 中是 `main-thread:` 冒号前缀）。这告诉 SWC 编译器这个值需要在主线程侧解析。

如果不加前缀，编译器会把它当作普通背景线程值，尝试序列化一个函数——而函数不可序列化，会导致运行时错误。
:::

## 总结

恭喜！你已经完成了一个高性能的商品详情页图片轮播组件。让我们回顾学到的核心概念：

- **Lynx 布局**：`display: linear` + `linear-orientation: horizontal` 创建高性能横向布局
- **主线程脚本** (`'main thread'`)：将触摸事件处理直接放在主线程执行，消除跨线程延迟
- **`useMainThreadRef`**：创建主线程上可读写的引用，替代背景线程的 `ref()`，通过 `.current` 访问
- **Vue 组合式函数**：将 MTS 逻辑提取到 `useOffset`、`useUpdateSwiperStyle`、`useAnimate` 等可复用模块
- **`runOnBackground`**：主线程 → 背景线程的函数调用桥接（指示器状态同步）
- **`runOnMainThread`**：背景线程 → 主线程的函数调用桥接（点击跳转动画）
- **跨线程传值**：背景线程的可序列化值自动传入主线程；主线程函数通过 `main-thread-` 前缀 prop 传递

完整的源码在 `packages/vue/e2e-lynx/src/swiper/` 目录下，包含三个渐进式版本供参考。

::: info MTS 函数体跨框架复用
一个有趣的发现：所有 `'main thread'` 标记的函数体（`handleTouchStart`、`updateOffset`、`animate` 等）在 Vue 和 React 版本中**完全相同**。SWC 编译器将这些函数提取到独立的主线程 bundle 中，与框架无关。

这意味着你可以直接复用 React Lynx 示例中的主线程函数逻辑——只需要适配外层的组件语法（SFC 模板 vs JSX）。
:::
