# Tutorial: Product Gallery

We will build a product gallery page together during this tutorial using Vue 3 and Lynx. This tutorial does not assume any existing Lynx knowledge. The techniques you'll learn in the tutorial are fundamental to building any Lynx pages and applications.

> **Note:** This tutorial is designed for people who prefer to learn by doing and want to quickly try making something tangible. If you prefer learning each concept step by step, start with [Describing the UI](/guide/ui/elements-components).

## What are we building?

A furniture gallery with a beautiful waterfall layout, tap-to-like interactions, auto-scrolling, and a custom scrollbar — driven by Main Thread Script for buttery-smooth performance. Each section builds incrementally on the previous one.

## Setup for the tutorial

Check out the detailed [quick start](/guide/start/quick-start.mdx) doc that will guide you through creating a new Lynx project. We recommend TypeScript for a better development experience, provided by static type checking and better editor IntelliSense.

You'll see lots of beautiful images throughout this guide. We've put together a package of sample images you can download [here](https://lf-lynx.tiktok-cdns.com/obj/lynx-artifacts-oss-sg/lynx-website/download/Pictures.tar.gz) to use in your projects.

When using Vue Lynx, your `lynx.config.ts` will use `pluginVueLynx` instead of `pluginReactLynx`:

```ts title="lynx.config.ts"
import { defineConfig } from '@lynx-js/rspeedy';
import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      // We'll add entries here as we go
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

## Adding Styles

Since the focus of this tutorial is not on how to style your UI, you may just save some time and directly copy the below `gallery.css` file:

<details>
<summary>gallery.css (click to expand)</summary>

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

and import it in your entry file:

```ts
import '../gallery.css';
```

This makes sure your UI looks great when you are following this tutorial.

> **Styling variations in Lynx:** Lynx supports a wide variety of styling features, including global styles, CSS Modules, inline styles, Sass, CSS variables, and more! Please refer to [Rspeedy - Styling](/rspeedy/styling) for how to pick your best styling configurations.

## Your First Component: An Image Card

Now, let's start by creating the first image card, which will be the main part of this page.

**Entry: `gallery-image-card`**

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

Great, you can now see the image card displayed. Here, we use the [`<image>`](/api/elements/built-in/image) element to display your image. You only need to give it a width and height (or specify the `aspectRatio` property as shown here), and it will automatically resize to fit the specified dimensions. This component can receive a `picture` property via `defineProps`, allowing you to change the image it displays.

> **The `src` Attribute of Images:** The Lynx `<image>` element can accept a local relative path as the `src` attribute to render an image. All images in this page are sourced locally, and these paths need to be imported before use. However, if your images are stored online, you can easily replace them with web image addresses.

> **Vue Lynx Entry Point:** Unlike React Lynx which uses `root.render(<App />)`, Vue Lynx uses `createApp(Component).mount()`. This creates the Vue application and mounts it to the Lynx page root.

## Adding interactivity: Like an Image Card

We can add a small white heart in the upper right corner and make it the like button for the image card. Here, we implement a small component called `LikeIcon`:

**Entry: `gallery-like-card`**

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

We want each card to know whether it has been liked, so we added `isLiked`, which is its internal data. It can use this internal data to save your changes.

```vue title="LikeIcon.vue" {2}
<script setup lang="ts">
const isLiked = ref(false);
</script>
```

In Vue, `ref(false)` creates a reactive variable (equivalent to React's `useState(false)`). When `isLiked.value` changes, Vue's reactivity system automatically re-renders the component — no `setState` call needed.

Then we add the `@tap` event to the wrapper `<view>`, so that when the user clicks the heart, it triggers this event and changes the state of `isLiked`:

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

> **What is `@tap`?** In Vue Lynx, event binding uses `@eventName` syntax (short for `v-on:eventName`). This is equivalent to React Lynx's `bindtap={handler}`. Lynx follows the `bind*` convention for events due to the static nature of its architecture. Learn more on the [Event Handling](/guide/interaction/event-handling) page.

Finally, we use `isLiked` to control the like effect. Because `isLiked` is reactive, `LikeIcon` will respond to its changes, turning into a red heart icon. The `<view>` elements used to render the ripple animation are conditionally rendered with `v-if`:

```vue title="LikeIcon.vue"
<template>
  <view class="like-icon" @tap="onTap">
    <view v-if="isLiked" class="circle" />
    <view v-if="isLiked" class="circle circleAfter" />
    <image :src="isLiked ? redHeart : whiteHeart" class="heart-love" />
  </view>
</template>
```

Now we compose the image card with the like icon overlay:

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

To give the like a better visual interaction effect, we added CSS animations in `gallery.css`. You can also learn more about animations in the [Animation](/guide/styling/animation) section and replace them with your preferred style!

## Displaying More Images with `<list>`

To show all your beautiful images, you may need help from `<list>`. This way, you will get a scrollable page that displays a large number of similar images:

**Entry: `gallery-list`**

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

> **Special child elements of `<list>`:** Each child of `<list>` needs to be `<list-item>`, and you must specify a unique and non-repeating `:key` and `:item-key` attribute, otherwise it may not render correctly.

In Vue, instead of React's `{array.map(...)}`, we use `v-for` to iterate over data and render a `<list-item>` for each picture.

We use a waterfall layout as the child node layout option. `<list>` also accepts other layout types, which you can refer to in the [`<list>` documentation](/api/elements/built-in/list).

> You can refer to the [Scrolling](/guide/ui/scrolling) documentation to learn more about scrolling and scrolling elements.

## Auto-Scrolling via Element Methods

If you want to create a desktop photo wall, you need to add an auto-scroll feature to this page. Your images will be slowly and automatically scrolled, allowing you to easily see more images:

**Entry: `gallery-autoscroll`**

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
  <!-- Same <list> template as before -->
</template>
```

We use `onMounted` (Vue's equivalent of React's `useEffect(() => ..., [])`) combined with `nextTick` to call the [`autoScroll`](/api/elements/built-in/list.html#autoscroll) method after the list is rendered. In Vue Lynx, we use `lynx.createSelectorQuery()` to select the list element by its `custom-list-name` attribute and invoke the native method.

> **What is `invoke`?** In Lynx, all native elements have a set of "methods" that can be called. Unlike on the web, this call is asynchronous, similar to message passing. You need to use `invoke` with the method name and parameters to call them.

> **`onMounted` + `nextTick`:** Vue's `onMounted` runs once when the component is mounted (like `useEffect` with an empty dependency array). We call `nextTick` inside it to wait for the main thread to finish creating the native elements. In Vue Lynx, `nextTick` is enhanced to wait for the cross-thread ops flush — not just Vue's internal scheduler — so elements are guaranteed to exist when the callback fires.

## How about a Custom Scrollbar?

Like most apps, we can add a scrollbar to this page to indicate how many images are left to be displayed. But we can do more! For example, we can replace the default progress bar of `<list>` with our preferred style:

**Entry: `gallery-scrollbar`**

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

The `NiceScrollbar` component exposes an `adjustScrollbar` method via `defineExpose`. In Vue, `defineExpose` is the equivalent of React's `forwardRef` + `useImperativeHandle` — it lets the parent component call methods on the child.

Similar to the `@tap` event used to add the like functionality, we add the [`scroll`](/api/elements/built-in/list.html#scroll) event to `<list>`, which will be triggered when the `<list>` element scrolls. To make the scrollbar respond faster to scroll events, we need to set [`scroll-event-throttle`](/api/elements/built-in/list.html#scroll-event-throttle) to 0.

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
      <!-- list items -->
    </list>
  </view>
</template>
```

In Vue, we use `ref<InstanceType<typeof NiceScrollbar>>()` to create a typed template ref. When we put `ref="scrollbarRef"` on the `<NiceScrollbar>` element, Vue automatically populates it with the component instance, giving us access to the exposed `adjustScrollbar` method.

> **`estimated-main-axis-size-px`:** You may have noticed this attribute on `<list-item>`. It estimates the size of elements on the main axis when they are not yet rendered in `<list>`. This is very useful when we add a scrollbar, as we need to know how long the scrollbar needs to be to cover all elements.
>
> We provide a utility method to estimate the size based on the current layout and image dimensions:
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

At this point, we have a complete page! But you may have noticed that the scrollbar we added still lags a bit during scrolling, not as responsive as it could be. This is because our adjustments are still happening on the background thread, not the main thread that responds to touch scrolling.

> **What are the background thread and main thread?** The biggest feature of Lynx is its dual-thread architecture. You can find a more detailed introduction in [JavaScript Runtime](/guide/scripting-runtime/index.html#javascript).

## A More Responsive Scrollbar

To optimize the performance of the scrollbar, we need to introduce [Main Thread Script (MTS)](/react/main-thread-script.html) to [handle events on the main thread](/guide/interaction/event-handling.html#main-thread-event-processing), migrating the adjustments we made in the previous step for the scrollbar's height and position from the background thread to the main thread.

To let you see the comparison more clearly, we keep both scrollbars:

**Entry: `gallery-scrollbar-compare`**

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

The MTS scrollbar uses `:main-thread-ref` to bind a `MainThreadRef` to the element, allowing the Main Thread to directly manipulate it without any background thread round-trips.

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

// BTS scroll handler
function onScroll(
  event: { detail?: { scrollTop?: number; scrollHeight?: number } },
) {
  scrollbarRef.value?.adjustScrollbar(
    event.detail?.scrollTop ?? 0,
    event.detail?.scrollHeight ?? 0,
  );
}

// MTS scroll handler (worklet context)
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
      <!-- list items -->
    </list>
  </view>
</template>
```

Now you should be able to see that the scrollbar on the left (darkkhaki), controlled with main thread scripting, is smoother and more responsive compared to the scrollbar on the right that we implemented earlier. If you encounter issues in other UIs where updates need to happen immediately, try this method.

Key Vue concepts for MTS:

- `useMainThreadRef(null)` — Creates a ref that can be resolved on the Main Thread (same API as React Lynx's `useMainThreadRef`)
- `:main-thread-bindscroll="ctx"` — Binds a worklet handler to the scroll event (runs on Main Thread, zero thread crossings)
- `.toJSON()` — Serializes the ref for cross-thread transfer (includes the internal `_wvid` identifier)

## Wrapping Up

We remove the redundant scrollbar used for comparison, and our Gallery is now complete! Let's take a look at the final result:

**Entry: `gallery-complete`**

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

// MainThreadRef for the scrollbar thumb element
const scrollbarThumbRef = useMainThreadRef(null);

// Hand-crafted worklet context (simulates SWC transform output)
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

Congratulations! You have successfully created a product gallery page! Throughout this tutorial, you've covered the basics of writing interactive UIs on the Lynx platform with Vue 3.

## React vs Vue Quick Reference

| Concept          | React Lynx                           | Vue Lynx                           |
| ---------------- | ------------------------------------ | ---------------------------------- |
| Create app       | `root.render(<App />)`               | `createApp(App).mount()`           |
| State            | `const [x, setX] = useState(val)`    | `const x = ref(val)`               |
| Update state     | `setX(newVal)`                       | `x.value = newVal`                 |
| Template ref     | `const ref = useRef(null)`           | `const el = ref(null)`             |
| Lifecycle        | `useEffect(() => ..., [])`           | `onMounted(() => ...)`             |
| Class name       | `className="foo"`                    | `class="foo"`                      |
| Conditional      | `{cond && <el />}`                   | `<el v-if="cond" />`               |
| List             | `{arr.map(x => <el key={x} />)}`     | `<el v-for="x in arr" :key="x" />` |
| Tap event        | `bindtap={handler}`                  | `@tap="handler"`                   |
| Scroll event     | `bindscroll={handler}`               | `@scroll="handler"`                |
| MTS scroll       | `main-thread:bindscroll={fn}`        | `:main-thread-bindscroll="ctx"`    |
| MTS ref          | `main-thread:ref={ref}`              | `:main-thread-ref="ref"`           |
| MT ref hook      | `useMainThreadRef(null)`             | `useMainThreadRef(null)`           |
| Expose to parent | `forwardRef` + `useImperativeHandle` | `defineExpose({ method })`         |
| Props            | `function Comp(props: { x: T })`     | `defineProps<{ x: T }>()`          |

## Running the Examples

```bash
# Install dependencies
pnpm install

# Build Vue runtime packages
cd packages/vue/runtime && pnpm build
cd packages/vue/main-thread && pnpm build

# Start the dev server
cd packages/vue/e2e-lynx && pnpm dev
```

Then open each bundle in LynxExplorer:

| Entry                       | Bundle                                  | What it shows                    |
| --------------------------- | --------------------------------------- | -------------------------------- |
| `gallery-image-card`        | `gallery-image-card.lynx.bundle`        | Single image card                |
| `gallery-like-card`         | `gallery-like-card.lynx.bundle`         | Card with tap-to-like            |
| `gallery-list`              | `gallery-list.lynx.bundle`              | Waterfall grid                   |
| `gallery-autoscroll`        | `gallery-autoscroll.lynx.bundle`        | Auto-scrolling gallery           |
| `gallery-scrollbar`         | `gallery-scrollbar.lynx.bundle`         | Gallery + BG Thread scrollbar    |
| `gallery-scrollbar-compare` | `gallery-scrollbar-compare.lynx.bundle` | BG vs MT scrollbar comparison    |
| `gallery-complete`          | `gallery-complete.lynx.bundle`          | Final gallery with MTS scrollbar |
