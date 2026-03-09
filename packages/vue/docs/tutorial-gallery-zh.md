# 教程：商品图片画廊

在本教程中，我们将使用 Vue 3 和 Lynx 一起构建一个商品图片画廊页面。本教程不要求任何 Lynx 的前置知识。你在本教程中学到的技术是构建任何 Lynx 页面和应用程序的基础。

> **注意：** 本教程适合喜欢"边做边学"、想快速做出实际成果的人。如果你更喜欢逐步学习每个概念，请从[描述 UI](/guide/ui/elements-components) 开始。

## 我们要构建什么？

一个家具图片画廊，包含精美的瀑布流布局、点赞交互、自动滚动和自定义滚动条 —— 由主线程脚本驱动，实现丝滑流畅的性能。每个章节都在上一个章节的基础上逐步构建。

## 准备工作

查看详细的[快速开始](/guide/start/quick-start.mdx)文档，它将指导你创建一个新的 Lynx 项目。我们推荐使用 TypeScript，以获得更好的开发体验，包括静态类型检查和更好的编辑器智能提示。

在本教程中你会看到很多精美的图片。我们准备了一套示例图片，你可以[在这里](https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/download/Pictures.tar.gz)下载，用于你的项目中。

使用 Vue Lynx 时，你的 `lynx.config.ts` 将使用 `pluginVueLynx` 而不是 `pluginReactLynx`：

```ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      // 我们会在进行过程中逐步添加入口
      'gallery-image-card': './src/gallery/ImageCard/index.ts',
    },
  },
  plugins: [
    pluginVueLynx({
      optionsApi: false,
      enableCSSSelector: true,
    }),
  ],
});
```

## 添加样式

由于本教程的重点不在于如何设置样式，你可以直接复制下面的 `gallery.css` 文件来节省时间：

<details>
<summary>gallery.css（点击展开）</summary>

```css title="gallery.css"
.gallery-wrapper {
  height: 100%;
  background-color: black;
}

.single-card {
  display: flex;
  align-items: center;
  justify-content: center;
}

.scrollbar {
  position: absolute;
  right: 7px;
  z-index: 1000;
  width: 4px;
  background: linear-gradient(to bottom, #ff6448, #ccddff, #3deae7);
  border-radius: 5px;
  overflow: hidden;
  box-shadow:
    0px 0px 4px 1px rgba(12, 205, 223, 0.4),
    0px 0px 16px 5px rgba(12, 205, 223, 0.5);
}

.scrollbar-effect {
  width: 100%;
  height: 80%;
}

.glow {
  background-color: #333;
  border-radius: 4px;
  background: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0) 20%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(255, 255, 255, 0) 80%
  );
  animation: flow 3s linear infinite;
}

@keyframes flow {
  0% {
    transform: translateY(-100%);
  }
  100% {
    transform: translateY(100%);
  }
}

.list {
  width: 100%;
  padding-bottom: 20px;
  padding-left: 20px;
  padding-right: 20px;
  height: calc(100% - 48px);
  list-main-axis-gap: 10px;
  list-cross-axis-gap: 10px;
}

.picture-wrapper {
  border-radius: 10px;
  overflow: hidden;
  width: 100%;
}

.like-icon {
  position: absolute;
  display: grid;
  justify-items: center;
  align-items: center;
  top: 0px;
  right: 0px;
  width: 48px;
  height: 48px;
}

.heart-love {
  width: 16px;
  height: 16px;
}

.circle {
  position: absolute;
  top: calc(50% - 8px);
  left: calc(50% - 8px);
  height: 16px;
  width: 16px;
  border: 2px solid red;
  border-radius: 50%;
  transform: scale(0);
  opacity: 1;
  animation: ripple 1s 1 ease-out;
}

.circleAfter {
  animation-delay: 0.5s;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}
```

</details>

然后在你的入口文件中导入它：

```ts
import '../gallery.css';
```

这样可以确保你在跟随本教程时，UI 看起来美观。

> **Lynx 中的样式方案：** Lynx 支持多种样式特性，包括全局样式、CSS Modules、内联样式、Sass、CSS 变量等！请参考 [Rspeedy - 样式](/rspeedy/styling) 来选择最适合你的样式配置。

## 你的第一个组件：图片卡片

现在，让我们从创建第一张图片卡片开始，它将是这个页面的核心组成部分。

**入口：`gallery-image-card`**

```vue title="ImageCard.vue" {4-5,10-12}
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';

defineProps<{
  picture: Picture;
}>();
</script>

<template>
  <view class="picture-wrapper">
    <image
      :style="{ width: '100%', aspectRatio: picture.width / picture.height }"
      :src="picture.src"
    />
  </view>
</template>
```

```ts title="ImageCard/index.ts" {6}
import '../gallery.css';
import { createApp, defineComponent, h } from '@lynx-js/vue-runtime';
import ImageCard from './ImageCard.vue';
import { furnituresPicturesSubArray } from '../Pictures/furnituresPictures';

const App = defineComponent({
  setup() {
    const picture = furnituresPicturesSubArray[0]!;
    return () =>
      h('view', { class: 'gallery-wrapper single-card' }, [
        h(ImageCard, { picture }),
      ]);
  },
});

const app = createApp(App);
app.mount();
```

很好，现在你可以看到图片卡片已经显示出来了。这里我们使用 [`<image>`](/api/elements/built-in/image) 元素来展示图片。你只需要给它一个宽度和高度（或者像这里一样指定 `aspectRatio` 属性），它就会自动调整大小以适应指定的尺寸。这个组件通过 `defineProps` 接收一个 `picture` 属性，允许你改变它显示的图片。

> **图片的 `src` 属性：** Lynx 的 `<image>` 元素可以接受本地相对路径作为 `src` 属性来渲染图片。本页中所有图片都来源于本地，这些路径需要在使用前导入。不过，如果你的图片存储在线上，你可以轻松替换为网络图片地址。

> **Vue Lynx 入口：** 与 React Lynx 使用 `root.render(<App />)` 不同，Vue Lynx 使用 `createApp(Component).mount()`。这会创建 Vue 应用并将其挂载到 Lynx 页面根节点。

## 添加交互：给图片卡片点赞

我们可以在右上角添加一个小白色心形图标，把它作为图片卡片的点赞按钮。在这里，我们实现一个名为 `LikeIcon` 的小组件：

**入口：`gallery-like-card`**

```vue title="Components/LikeIcon.vue" {4,7-9,13-15}
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

import redHeart from '../Pictures/redHeart.png';
import whiteHeart from '../Pictures/whiteHeart.png';

const isLiked = ref(false);

function onTap() {
  isLiked.value = true;
}
</script>

<template>
  <view class="like-icon" @tap="onTap">
    <view v-if="isLiked" class="circle" />
    <view v-if="isLiked" class="circle circleAfter" />
    <image :src="isLiked ? redHeart : whiteHeart" class="heart-love" />
  </view>
</template>
```

我们希望每张卡片知道自己是否被点赞了，所以添加了 `isLiked` 作为内部数据。它可以用这个内部数据来保存你的操作。

```vue title="LikeIcon.vue" {2}
<script setup lang="ts">
const isLiked = ref(false);
</script>
```

在 Vue 中，`ref(false)` 创建一个响应式变量（等同于 React 的 `useState(false)`）。当 `isLiked.value` 改变时，Vue 的响应式系统会自动重新渲染组件 —— 不需要调用 `setState`。

然后我们在外层 `<view>` 上添加 `@tap` 事件，这样当用户点击心形图标时，就会触发这个事件并改变 `isLiked` 的状态：

```vue title="LikeIcon.vue" {2,5}
<script setup lang="ts">
function onTap() {
  isLiked.value = true;
}
</script>

<template>
  <view class="like-icon" @tap="onTap">
    ...
  </view>
</template>
```

> **什么是 `@tap`？** 在 Vue Lynx 中，事件绑定使用 `@eventName` 语法（`v-on:eventName` 的缩写）。这等同于 React Lynx 的 `bindtap={handler}`。由于其架构的静态特性，Lynx 遵循 `bind*` 的事件命名约定。在[事件处理](/guide/interaction/event-handling)页面了解更多。

最后，我们使用 `isLiked` 来控制点赞效果。因为 `isLiked` 是响应式的，`LikeIcon` 会响应它的变化，变成红色心形图标。用于渲染涟漪动画的 `<view>` 元素通过 `v-if` 条件渲染：

```vue title="LikeIcon.vue"
<template>
  <view class="like-icon" @tap="onTap">
    <view v-if="isLiked" class="circle" />
    <view v-if="isLiked" class="circle circleAfter" />
    <image :src="isLiked ? redHeart : whiteHeart" class="heart-love" />
  </view>
</template>
```

现在我们将图片卡片与点赞图标组合在一起：

```vue title="Components/LikeImageCard.vue" {3,10}
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';
import LikeIcon from './LikeIcon.vue';

defineProps<{
  picture: Picture;
}>();
</script>

<template>
  <view class="picture-wrapper">
    <image
      :style="{ width: '100%', aspectRatio: picture.width / picture.height }"
      :src="picture.src"
    />
    <LikeIcon />
  </view>
</template>
```

为了让点赞有更好的视觉交互效果，我们在 `gallery.css` 中添加了 CSS 动画。你也可以在[动画](/guide/styling/animation)章节了解更多，并替换为你喜欢的样式！

## 使用 `<list>` 展示更多图片

要展示所有精美的图片，你需要 `<list>` 的帮助。这样你就能得到一个可滚动的页面，展示大量类似的图片：

**入口：`gallery-list`**

```vue title="GalleryList/Gallery.vue" {9,10,18,22}
<script setup lang="ts">
import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';
import LikeImageCard from '../Components/LikeImageCard.vue';
</script>

<template>
  <view class="gallery-wrapper">
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
    >
      <list-item
        v-for="(pic, i) in furnituresPictures"
        :key="i"
        :item-key="String(i)"
        :estimated-main-axis-size-px="calculateEstimatedSize(pic.width, pic.height)"
      >
        <LikeImageCard :picture="pic" />
      </list-item>
    </list>
  </view>
</template>
```

> **`<list>` 的特殊子元素：** `<list>` 的每个子元素必须是 `<list-item>`，并且必须指定唯一且不重复的 `:key` 和 `:item-key` 属性，否则可能无法正确渲染。

在 Vue 中，我们不使用 React 的 `{array.map(...)}`，而是用 `v-for` 来遍历数据，为每张图片渲染一个 `<list-item>`。

我们使用瀑布流布局作为子节点的布局方式。`<list>` 也支持其他布局类型，你可以参考 [`<list>` 文档](/api/elements/built-in/list)。

> 你可以参考[滚动](/guide/ui/scrolling)文档来了解更多关于滚动和滚动元素的信息。

## 通过元素方法实现自动滚动

如果你想创建一个桌面照片墙，你需要为这个页面添加自动滚动功能。你的图片会缓慢自动滚动，让你可以轻松地看到更多图片：

**入口：`gallery-autoscroll`**

```vue title="GalleryAutoScroll/Gallery.vue" {1,12-22}
<script setup lang="ts">
import { onMounted, nextTick } from '@lynx-js/vue-runtime';
import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';
import LikeImageCard from '../Components/LikeImageCard.vue';

declare const lynx: {
  createSelectorQuery(): {
    select(selector: string): {
      invoke(options: { method: string; params: Record<string, string> }): {
        exec(): void;
      };
    };
  };
};

onMounted(() => {
  nextTick(() => {
    lynx
      .createSelectorQuery()
      .select('[custom-list-name="list-container"]')
      .invoke({
        method: 'autoScroll',
        params: { rate: '60', start: 'true' },
      })
      .exec();
  });
});
</script>

<template>
  <!-- 与之前相同的 <list> 模板 -->
</template>
```

我们使用 `onMounted`（Vue 中等同于 React 的 `useEffect(() => ..., [])`）结合 `nextTick`，在列表渲染后调用 [`autoScroll`](/api/elements/built-in/list.html#autoscroll) 方法。在 Vue Lynx 中，我们使用 `lynx.createSelectorQuery()` 通过 `custom-list-name` 属性选择列表元素并调用原生方法。

> **什么是 `invoke`？** 在 Lynx 中，所有原生元素都有一组可以调用的"方法"。与 Web 不同，这种调用是异步的，类似于消息传递。你需要使用 `invoke` 配合方法名和参数来调用它们。

> **`onMounted` + `nextTick`：** Vue 的 `onMounted` 在组件挂载时运行一次（类似带空依赖数组的 `useEffect`）。我们在其中调用 `nextTick` 来等待主线程完成原生元素的创建。在 Vue Lynx 中，`nextTick` 被增强为不仅等待 Vue 内部调度器，还等待跨线程操作刷新完成 —— 因此回调触发时，元素保证已经存在。

## 如何添加自定义滚动条？

和大多数应用一样，我们可以为这个页面添加一个滚动条来指示还有多少图片未显示。但我们可以做得更好！例如，我们可以用自己喜欢的样式替换 `<list>` 的默认进度条：

**入口：`gallery-scrollbar`**

```vue title="GalleryScrollbar/NiceScrollbar.vue" {7-11,13}
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

declare const SystemInfo: { pixelHeight: number; pixelRatio: number };

const scrollbarHeight = ref(0);
const scrollbarTop = ref(0);

function adjustScrollbar(scrollTop: number, scrollHeight: number) {
  const listHeight = SystemInfo.pixelHeight / SystemInfo.pixelRatio - 48;
  scrollbarHeight.value = listHeight * (listHeight / scrollHeight);
  scrollbarTop.value = listHeight * (scrollTop / scrollHeight);
}

defineExpose({ adjustScrollbar });
</script>

<template>
  <view
    class="scrollbar"
    :style="{ height: scrollbarHeight + 'px', top: scrollbarTop + 'px' }"
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>
```

`NiceScrollbar` 组件通过 `defineExpose` 暴露了 `adjustScrollbar` 方法。在 Vue 中，`defineExpose` 等同于 React 的 `forwardRef` + `useImperativeHandle` —— 它让父组件可以调用子组件的方法。

类似于用于添加点赞功能的 `@tap` 事件，我们给 `<list>` 添加 [`scroll`](/api/elements/built-in/list.html#scroll) 事件，它会在 `<list>` 元素滚动时触发。为了让滚动条更快地响应滚动事件，我们需要将 [`scroll-event-throttle`](/api/elements/built-in/list.html#scroll-event-throttle) 设为 0。

```vue title="GalleryScrollbar/Gallery.vue" {12,19,21}
<script setup lang="ts">
import { ref, onMounted, nextTick } from '@lynx-js/vue-runtime';
import LikeImageCard from '../Components/LikeImageCard.vue';
import NiceScrollbar from './NiceScrollbar.vue';

const scrollbarRef = ref<InstanceType<typeof NiceScrollbar> | null>(null);

function onScroll(
  event: { detail?: { scrollTop?: number; scrollHeight?: number } },
) {
  const scrollTop = event.detail?.scrollTop ?? 0;
  const scrollHeight = event.detail?.scrollHeight ?? 0;
  scrollbarRef.value?.adjustScrollbar(scrollTop, scrollHeight);
}
</script>

<template>
  <view class="gallery-wrapper">
    <NiceScrollbar ref="scrollbarRef" />
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
      @scroll="onScroll"
      :scroll-event-throttle="0"
    >
      <!-- 列表项 -->
    </list>
  </view>
</template>
```

在 Vue 中，我们使用 `ref<InstanceType<typeof NiceScrollbar>>()` 创建一个有类型的模板引用。当我们在 `<NiceScrollbar>` 元素上放置 `ref="scrollbarRef"` 时，Vue 会自动用组件实例填充它，让我们可以访问暴露的 `adjustScrollbar` 方法。

> **`estimated-main-axis-size-px`：** 你可能已经注意到 `<list-item>` 上的这个属性。它在 `<list>` 中元素尚未渲染时估算元素在主轴上的尺寸。当我们添加滚动条时这非常有用，因为我们需要知道滚动条需要多长才能覆盖所有元素。
>
> 我们提供了一个工具方法来根据当前布局和图片尺寸估算大小：
>
> ```ts title="utils.ts"
> export const calculateEstimatedSize = (
>   pictureWidth: number,
>   pictureHeight: number,
> ): number => {
>   const galleryPadding = 20;
>   const galleryMainAxisGap = 10;
>   const gallerySpanCount = 2;
>   const galleryWidth = SystemInfo.pixelWidth / SystemInfo.pixelRatio;
>   const itemWidth = (galleryWidth - galleryPadding * 2 - galleryMainAxisGap)
>     / gallerySpanCount;
>   return (itemWidth / pictureWidth) * pictureHeight;
> };
> ```

到此为止，我们有了一个完整的页面！但你可能注意到，我们添加的滚动条在滚动时仍有一点延迟，不够灵敏。这是因为我们的调整仍然在背景线程上进行，而不是响应触摸滚动的主线程上。

> **什么是背景线程和主线程？** Lynx 最大的特点是其双线程架构。你可以在 [JavaScript 运行时](/guide/scripting-runtime/index.html#javascript)中找到更详细的介绍。

## 更灵敏的滚动条

为了优化滚动条的性能，我们需要引入[主线程脚本 (MTS)](/react/main-thread-script.html) 来[在主线程上处理事件](/guide/interaction/event-handling.html#main-thread-event-processing)，将上一步中对滚动条高度和位置的调整从背景线程迁移到主线程。

为了让你更清楚地看到对比，我们保留两个滚动条：

**入口：`gallery-scrollbar-compare`**

```vue title="ScrollbarCompare/NiceScrollbarMTS.vue" {5,10}
<script setup lang="ts">
import type { MainThreadRef } from '@lynx-js/vue-runtime';

defineProps<{
  thumbRef: MainThreadRef;
}>();
</script>

<template>
  <view
    class="scrollbar"
    :main-thread-ref="thumbRef"
    :style="
      {
        right: '14px',
        backgroundColor: 'darkkhaki',
      }
    "
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>
```

MTS 滚动条使用 `:main-thread-ref` 将一个 `MainThreadRef` 绑定到元素上，允许主线程直接操作它，无需任何背景线程的往返。

```vue title="ScrollbarCompare/Gallery.vue" {3,7,14-18,21}
<script setup lang="ts">
import {
  ref,
  onMounted,
  nextTick,
  useMainThreadRef,
} from '@lynx-js/vue-runtime';
import NiceScrollbar from './NiceScrollbar.vue';
import NiceScrollbarMTS from './NiceScrollbarMTS.vue';

const scrollbarRef = ref<InstanceType<typeof NiceScrollbar> | null>(null);
const scrollbarThumbRef = useMainThreadRef(null);

// 背景线程滚动处理
function onScroll(
  event: { detail?: { scrollTop?: number; scrollHeight?: number } },
) {
  scrollbarRef.value?.adjustScrollbar(
    event.detail?.scrollTop ?? 0,
    event.detail?.scrollHeight ?? 0,
  );
}

// 主线程滚动处理（worklet 上下文）
const onScrollMTSCtx = {
  _wkltId: 'gallery:adjustScrollbarCompare',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
};
onScrollMTSCtx._c = { _thumbRef: scrollbarThumbRef.toJSON() };
</script>

<template>
  <view class="gallery-wrapper">
    <NiceScrollbar ref="scrollbarRef" />
    <NiceScrollbarMTS :thumb-ref="scrollbarThumbRef" />
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
      @scroll="onScroll"
      :main-thread-bindscroll="onScrollMTSCtx"
      :scroll-event-throttle="0"
    >
      <!-- 列表项 -->
    </list>
  </view>
</template>
```

现在你应该能看到，左边的滚动条（暗黄色），由主线程脚本控制，比我们之前实现的右边滚动条更加**流畅和灵敏**。如果你在其他 UI 中遇到需要即时更新的问题，可以试试这个方法。

Vue 中 MTS 的关键概念：

- `useMainThreadRef(null)` —— 创建一个可在主线程上解析的引用（与 React Lynx 的 `useMainThreadRef` API 相同）
- `:main-thread-bindscroll="ctx"` —— 将 worklet 处理器绑定到滚动事件（在主线程上运行，零线程切换）
- `.toJSON()` —— 序列化引用以进行跨线程传输（包含内部 `_wvid` 标识符）

## 完成

我们移除用于对比的多余滚动条，我们的画廊就完成了！让我们看看最终效果：

**入口：`gallery-complete`**

```vue title="GalleryComplete/NiceScrollbarMTS.vue"
<script setup lang="ts">
import type { MainThreadRef } from '@lynx-js/vue-runtime';

defineProps<{
  thumbRef: MainThreadRef;
}>();
</script>

<template>
  <view
    class="scrollbar"
    :main-thread-ref="thumbRef"
  >
    <view class="scrollbar-effect glow" />
  </view>
</template>
```

```vue title="GalleryComplete/Gallery.vue" {9,15-19,22,28}
<script setup lang="ts">
import { onMounted, useMainThreadRef } from '@lynx-js/vue-runtime';
import { furnituresPictures } from '../Pictures/furnituresPictures';
import { calculateEstimatedSize } from '../utils';
import LikeImageCard from '../Components/LikeImageCard.vue';
import NiceScrollbarMTS from './NiceScrollbarMTS.vue';

// 滚动条滑块元素的 MainThreadRef
const scrollbarThumbRef = useMainThreadRef(null);

// 手工构建的 worklet 上下文（模拟 SWC 转换输出）
const onScrollMTSCtx = {
  _wkltId: 'gallery:adjustScrollbarMTS',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
};
onScrollMTSCtx._c = { _thumbRef: scrollbarThumbRef.toJSON() };

onMounted(() => {
  nextTick(() => {
    lynx
      .createSelectorQuery()
      .select('[custom-list-name="list-container"]')
      .invoke({ method: 'autoScroll', params: { rate: '60', start: 'true' } })
      .exec();
  });
});
</script>

<template>
  <view class="gallery-wrapper">
    <NiceScrollbarMTS :thumb-ref="scrollbarThumbRef" />
    <list
      class="list"
      list-type="waterfall"
      :column-count="2"
      scroll-orientation="vertical"
      custom-list-name="list-container"
      :main-thread-bindscroll="onScrollMTSCtx"
      :scroll-event-throttle="0"
    >
      <list-item
        v-for="(pic, i) in furnituresPictures"
        :key="i"
        :item-key="String(i)"
        :estimated-main-axis-size-px="calculateEstimatedSize(pic.width, pic.height)"
      >
        <LikeImageCard :picture="pic" />
      </list-item>
    </list>
  </view>
</template>
```

恭喜！你已经成功创建了一个商品图片画廊页面！在本教程中，你已经涵盖了使用 Vue 3 在 Lynx 平台上编写交互式 UI 的基础知识。

## React 与 Vue 快速对照

| 概念         | React Lynx                           | Vue Lynx                           |
| ------------ | ------------------------------------ | ---------------------------------- |
| 创建应用     | `root.render(<App />)`               | `createApp(App).mount()`           |
| 状态         | `const [x, setX] = useState(val)`    | `const x = ref(val)`               |
| 更新状态     | `setX(newVal)`                       | `x.value = newVal`                 |
| 模板引用     | `const ref = useRef(null)`           | `const el = ref(null)`             |
| 生命周期     | `useEffect(() => ..., [])`           | `onMounted(() => ...)`             |
| 类名         | `className="foo"`                    | `class="foo"`                      |
| 条件渲染     | `{cond && <el />}`                   | `<el v-if="cond" />`               |
| 列表渲染     | `{arr.map(x => <el key={x} />)}`     | `<el v-for="x in arr" :key="x" />` |
| 点击事件     | `bindtap={handler}`                  | `@tap="handler"`                   |
| 滚动事件     | `bindscroll={handler}`               | `@scroll="handler"`                |
| MTS 滚动     | `main-thread:bindscroll={fn}`        | `:main-thread-bindscroll="ctx"`    |
| MTS 引用     | `main-thread:ref={ref}`              | `:main-thread-ref="ref"`           |
| MT ref hook  | `useMainThreadRef(null)`             | `useMainThreadRef(null)`           |
| 暴露给父组件 | `forwardRef` + `useImperativeHandle` | `defineExpose({ method })`         |
| Props        | `function Comp(props: { x: T })`     | `defineProps<{ x: T }>()`          |

## 运行示例

```bash
# 安装依赖
pnpm install

# 构建 Vue 运行时包
cd packages/vue/runtime && pnpm build
cd packages/vue/main-thread && pnpm build

# 启动开发服务器
cd packages/vue/e2e-lynx && pnpm dev
```

然后在 LynxExplorer 中打开每个 bundle：

| 入口                        | Bundle                                  | 展示内容                     |
| --------------------------- | --------------------------------------- | ---------------------------- |
| `gallery-image-card`        | `gallery-image-card.lynx.bundle`        | 单张图片卡片                 |
| `gallery-like-card`         | `gallery-like-card.lynx.bundle`         | 带点赞的卡片                 |
| `gallery-list`              | `gallery-list.lynx.bundle`              | 瀑布流网格                   |
| `gallery-autoscroll`        | `gallery-autoscroll.lynx.bundle`        | 自动滚动画廊                 |
| `gallery-scrollbar`         | `gallery-scrollbar.lynx.bundle`         | 画廊 + 背景线程滚动条        |
| `gallery-scrollbar-compare` | `gallery-scrollbar-compare.lynx.bundle` | 背景线程 vs 主线程滚动条对比 |
| `gallery-complete`          | `gallery-complete.lynx.bundle`          | 最终画廊（MTS 滚动条）       |
