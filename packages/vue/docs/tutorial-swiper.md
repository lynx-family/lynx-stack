# Tutorial: Product Detail

This tutorial walks you through building a high-performance product detail page with **Vue 3** and **Lynx**, centered around a touch-swipeable image carousel.

You will learn:

- [**Building a Static Layout**](#building-a-static-layout): Using `v-for` and Lynx's `display: linear` to create a horizontal scroll structure
- [**Listening to Touch Events**](#listening-to-touch-events): Handling touch events on the background thread and updating node styles
- [**Using Main Thread Script to Reduce Latency**](#using-main-thread-script-to-reduce-latency): Eliminating cross-thread round-trip delay with the `'main thread'` directive
- [**Organizing Code with Composables**](#organizing-code-with-composables): Extracting touch logic and style updates into reusable composables
- [**Adding Snap-to-Page Animation**](#adding-snap-to-page-animation): Main-thread `requestAnimationFrame`-based animation
- [**Communication Between Main Thread and Background Thread**](#communication-between-main-thread-and-background-thread): Cross-thread function calls with `runOnBackground` and `runOnMainThread`
- [**Values Across Main Thread and Background Thread**](#values-across-main-thread-and-background-thread): Passing numeric values and main-thread functions between threads

## What Are We Building?

The end result is a product detail page. At the top is a full-width image carousel that supports:

- **Zero-latency** finger-drag scrolling through images
- Automatic **snap-to-nearest-page** with easing animation on release
- A bottom **indicator** that highlights the current page in real time
- **Tap an indicator dot** to jump to that page

<!-- Final version entry: Swiper/index.ts -->

## Setup for the Tutorial

This tutorial assumes you have completed the environment setup in the [Quick Start](https://lynxjs.org/next/guide/start/quick-start.html) guide and have the LynxExplorer app installed.

All source code lives under `packages/vue/e2e-lynx/src/swiper/`, organized into three progressive entry points:

| Entry         | Description                                                      | Tutorial Section                                                        |
| ------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `SwiperEmpty` | Static layout, no interaction                                    | [Building a Static Layout](#building-a-static-layout)                   |
| `SwiperMTS`   | Main-thread touch handling, no animation/indicator               | [Using Main Thread Script](#using-main-thread-script-to-reduce-latency) |
| `Swiper`      | Full version: animation + indicator + cross-thread communication | [Adding Animation](#adding-snap-to-page-animation) and beyond           |

TypeScript is recommended for better editor hints and type checking.

## Building a Static Layout

Let's start with the simplest version — a non-interactive static image list.

### Creating the SwiperItem Component

Each image is wrapped in a `SwiperItem` component:

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

### Creating the Swiper Component

Render the image list with `v-for`, using Lynx's `display: linear` for horizontal layout:

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

The key CSS — `display: linear` is a Lynx-specific layout mode, similar to flexbox but more performant:

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

::: info Lynx's display: linear
Lynx supports a `display: linear` layout mode where `linear-orientation: horizontal` arranges children horizontally. Compared to `display: flex`, `linear` layout has better performance in Lynx's native rendering engine.
:::

### Creating the Entry Point

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

Open LynxExplorer and preview `SwiperEmpty` — you'll see a row of images laid out horizontally, but you can't swipe them. Let's add touch interaction next.

## Listening to Touch Events

To make the images swipeable, we need to:

1. Listen to `touchstart` / `touchmove` / `touchend` events
2. Calculate the finger's displacement
3. Apply the displacement to the container's `transform` style

### The Background Thread Approach

In Vue Lynx, event handlers run on the **background thread** by default. We can use regular Vue `ref`s to track touch state:

```vue title="Swiper.vue (background thread approach)" {3,6-8,11-13,16-19,22-23}
<script setup lang="ts">
import { ref } from 'vue';
import SwiperItem from '../Components/SwiperItem.vue';

// Touch state
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
  // Need to update the style... how?
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

But there's a problem — on the background thread, we have **no direct access to DOM nodes**. To update the container's `transform` style, we'd need to make an async **cross-thread round-trip** via an API like `lynx.createSelectorQuery()`.

::: details Why not use reactive state to update position?
You might think: just bind `:style="{ transform: 'translateX(' + currentOffset + 'px)' }"` and let Vue handle it?

This **works**, but every `touchmove` (fired 60–120 times per second) would trigger Vue's reactive update → diff → ops generation → cross-thread send → main-thread apply. This full update pipeline introduces noticeable latency, especially on low-end devices.

For high-frequency touch events, we need a more direct way to update styles.
:::

### The Latency Problem

In Lynx's dual-thread architecture, the default touch event handling flow is:

```
┌──────────────┐    Touch event    ┌──────────────┐    Update style    ┌──────────────┐
│   Native     │ ────────────────▶ │  Background   │ ────────────────▶ │  Main Thread │
│ (touch fires)│                   │   Thread      │  cross-thread     │ (apply style)│
│              │                   │ (handle event)│     call          │              │
└──────────────┘                   └──────────────┘                    └──────────────┘
```

Every touch move requires a full **main thread → background thread → main thread** round-trip, which causes perceivable **swipe lag** on low-end devices.

The solution? **Run the event handler directly on the main thread.**

## Using Main Thread Script to Reduce Latency

[Main Thread Script](https://lynxjs.org/next/guide/interaction/main-thread-script/quick-start.html) lets us mark functions to run on the main thread, completely eliminating cross-thread round-trip delay.

### Three Key Changes

Converting from the background thread approach to main thread requires just three steps:

**1. Replace `ref` with `useMainThreadRef`**

Main-thread functions cannot access background-thread `ref()`s. Use `useMainThreadRef` instead — it creates references that are readable and writable on the main thread:

```ts {1,4-7}
import { useMainThreadRef } from '@lynx-js/vue-runtime';

// Before: const touchStartX = ref(0);
const containerRef = useMainThreadRef<unknown>(null);
const currentOffsetRef = useMainThreadRef<number>(0);
const touchStartXRef = useMainThreadRef<number>(0);
const touchStartOffsetRef = useMainThreadRef<number>(0);
```

::: info How to access useMainThreadRef
`useMainThreadRef` returns a reference accessed via the `.current` property on the main thread (not Vue's `.value`). This is because the main-thread runtime uses `.current` as its unified access protocol, consistent with React's `useRef`.

```ts
// Background thread: Vue ref
const count = ref(0);
count.value = 1;

// Main thread: MainThreadRef
const countRef = useMainThreadRef<number>(0);
// Inside a 'main thread' function:
countRef.current = 1;
```

:::

**2. Add the `'main thread'` directive to functions**

Add the string literal `'main thread'` as the first line of a function body. The SWC compiler will automatically extract this function into the main-thread bundle:

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
  // Directly manipulate the main-thread node's style
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

**3. Use the `main-thread-` prefix in templates**

Vue Lynx uses the `main-thread-` prefix to route event bindings and refs to the main thread:

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

::: details Attribute prefix differences between Vue and React
React Lynx uses colon-separated attribute names (`main-thread:ref`, `main-thread:bindtouchstart`) because JSX supports this syntax.

Vue templates don't support colons in attribute names, so they use the `main-thread-` hyphenated prefix with `v-bind` (`:`):

```vue
<!-- React Lynx -->
<view main-thread:ref="{containerRef}" main-thread:bindtouchstart="{fn}" />

<!-- Vue Lynx -->
<view :main-thread-ref="containerRef" :main-thread-bindtouchstart="fn" />
```

The effect is identical — it's just adapted to Vue template syntax.
:::

### The Complete SwiperMTS Component

Combining the above changes, here is the complete main-thread touch handling version:

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

Open LynxExplorer and preview `SwiperMTS` — drag the images and you'll find the swipe responds **instantly** with zero lag.

::: details Use Main Thread Script Sparingly
Only use main thread script when you encounter **latency issues with high-frequency events**. Overuse increases the main thread's burden and can cause jank.

Good use cases:

- High-frequency events like `touchmove` and `scroll`
- Drag interactions requiring immediate response
- Animation frame updates

Not recommended for:

- Simple `tap` click handlers
- Infrequent UI updates
- Logic requiring complex data processing
  :::

## Organizing Code with Composables

Currently all logic lives in a single component. As we add features (animation, indicator), the code will become hard to maintain. Vue 3's [Composables](https://vuejs.org/guide/reusability/composables.html) help us organize code — equivalent to custom Hooks in React.

### useUpdateSwiperStyle — Container Ref and Style Updates

Extract the `containerRef` and style update logic:

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

### useOffset — Touch Handling and Offset Tracking

Extract the core touch event logic into `useOffset`, using callbacks for decoupling:

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

### The Simplified Swiper.vue

The component becomes a thin assembly layer:

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

::: info Composables vs React Hooks
Vue composables and React Hooks share the same goal — logic reuse and separation of concerns. But the Vue version is more flexible:

- **No call-order rules**: No need to follow "Rules of Hooks"; composables can be called anywhere
- **Natural closure reuse**: Functions marked with `'main thread'` capture `useMainThreadRef` references via closures, just like ordinary functions

The main-thread function bodies are **identical** between both frameworks — the `'main thread'` directive is framework-agnostic.
:::

Currently, releasing a drag leaves the image at an arbitrary position. Let's add snap-to-page animation next.

## Adding Snap-to-Page Animation

On release, the swiper should automatically slide to the nearest full page. This requires a `requestAnimationFrame`-based animation running on the main thread.

### useAnimate — RAF Animation Composable

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

Note: the `easing` function also needs the `'main thread'` directive because it will be called inside `animateInner` on the main thread.

### Updating useOffset — Adding Snap Logic

In `handleTouchEnd`, calculate the nearest page position and start the animation:

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
  // New: animation composable
  const { animate, cancel: cancelAnimate } = useAnimate();

  // New: calculate nearest full-page offset
  function calcNearestPage(offset: number) {
    'main thread';
    const nearestPage = Math.round(offset / itemWidth);
    return nearestPage * itemWidth;
  }

  function updateOffset(offset: number) {
    'main thread';
    // New: clamp to bounds
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
    cancelAnimate(); // New: cancel ongoing animation on touch
  }

  // handleTouchMove unchanged...

  function handleTouchEnd() {
    'main thread';
    touchStartXRef.current = 0;
    touchStartCurrentOffsetRef.current = 0;
    // New: animate to nearest page on release
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

Now releasing a drag smoothly snaps to the nearest page with easing.

But we still don't have a page indicator — the user doesn't know which page they're on. Adding an indicator requires a key capability: **notifying the background thread from the main thread**.

## Communication Between Main Thread and Background Thread

The Indicator component is an ordinary Vue component running on the background thread, driven by a reactive `ref`. But the current page index changes inside `handleTouchMove` on the main thread.

We need a way to **call a background-thread function from a main-thread function**.

::: info Main thread and background thread functions cannot call each other directly
Main thread script and background thread script run in **completely separate runtime environments**. A function in one runtime cannot directly call a function in the other — they need dedicated bridging APIs to communicate:

- `runOnBackground(fn)` — called from a main-thread function; asynchronously executes background-thread `fn`
- `runOnMainThread(fn)` — called from the background thread; asynchronously executes main-thread function `fn`
  :::

### Main Thread Calling Background Thread — `runOnBackground`

When the user drags images, `updateOffset` on the main thread calculates the current page index. We need to sync this index to the background thread's indicator state:

```ts title="Swiper/useOffset.ts" {1,8,10,23-27}
import { runOnBackground, useMainThreadRef } from '@lynx-js/vue-runtime';

export function useOffset({
  onOffsetUpdate,
  onIndexUpdate, // New: background-thread index update callback
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
    // ...(bounds clamping and style update unchanged)
    const index = Math.round(-realOffset / itemWidth);
    if (currentIndexRef.current !== index) {
      currentIndexRef.current = index;
      runOnBackground(onIndexUpdate)(index); // MT -> BG
    }
  }
  // ...
}
```

`runOnBackground(onIndexUpdate)(index)` means: **on the background thread**, asynchronously call `onIndexUpdate` with `index` as the argument.

::: details Why not call onIndexUpdate(index) directly?
If you try to call `onIndexUpdate(index)` directly inside a `'main thread'` function, the SWC compiler will produce an error. `onIndexUpdate` (i.e., the callback that updates `currentIndex.value`) is a background-thread function — it **doesn't exist** in the main-thread runtime.

```ts
function updateOffset(offset: number) {
  'main thread';
  // Wrong: onIndexUpdate is a background-thread function
  onIndexUpdate(index);

  // Correct: bridge via runOnBackground
  runOnBackground(onIndexUpdate)(index);
}
```

:::

### Background Thread Calling Main Thread — `runOnMainThread`

Tapping an indicator dot should jump to the corresponding page. The tap handler runs on the background thread, but the slide animation runs on the main thread. This requires **the background thread to call the main thread**:

```ts title="Swiper/useOffset.ts" {1-2,5-8}
import {
  runOnBackground,
  runOnMainThread,
  useMainThreadRef,
} from '@lynx-js/vue-runtime';

// New: background-thread function, called by Indicator's tap callback
function updateIndex(index: number) {
  const offset = -index * itemWidth;
  runOnMainThread(updateOffset)(offset); // BG -> MT
}
```

`runOnMainThread(updateOffset)(offset)` means: **on the main thread**, asynchronously call `updateOffset` with `offset` as the argument. This triggers the main-thread style update from the background thread.

### Adding the Indicator Component

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

### Assembling in Swiper

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
      currentIndex.value = index; // Update reactive state on BG thread
    },
    onOffsetUpdate: updateSwiperStyle,
  });

function handleItemClick(index: number) {
  currentIndex.value = index;
  updateIndex(index); // BG -> MT jump animation
}
</script>

<template>
  <view class="swiper-wrapper">
    <view class="swiper-container" ...>
      <!-- SwiperItem v-for unchanged -->
    </view>
    <Indicator
      :total="data.length"
      :current="currentIndex"
      @item-click="handleItemClick"
    />
  </view>
</template>
```

Now the indicator tracks swipe progress in real time, and tapping a dot jumps to that page. Here's the data flow:

```
Drag swipe (MT):
  handleTouchMove -> updateOffset -> runOnBackground(onIndexUpdate) -> currentIndex.value
                                                                              |
                                                                       Indicator updates

Tap to jump (BG -> MT):
  handleItemClick -> updateIndex -> runOnMainThread(updateOffset) -> animated slide
```

## Values Across Main Thread and Background Thread

Currently the animation duration and easing curve are hardcoded. We want to pass them in as component props. But this involves a subtle question: **How can main-thread functions use background-thread values?**

### Main Thread Functions Using Background Thread Values

`duration` (animation length) is an ordinary number value defined in background-thread props. The main-thread `handleTouchEnd` function needs to use it.

Good news: **main-thread functions can automatically capture background-thread values**. When `useOffset` receives a `duration` parameter and the function's closure references it, the SWC compiler automatically serializes and passes these values to the main thread at render time:

```ts title="Swiper/useOffset.ts" {5,14}
export function useOffset({
  onOffsetUpdate,
  onIndexUpdate,
  itemWidth,
  dataLength,
  duration, // background-thread value
}: {
  // ...
  duration?: number;
}) {
  // ...
  function handleTouchEnd() {
    'main thread';
    animate({
      // ...
      duration, // Automatically passed from BG to MT
    });
  }
}
```

::: info Limitations of automatic value passing
Background-thread values captured by main-thread functions must be **serializable** (number, string, boolean, plain object, array). Functions and Promises cannot be passed directly.

Also, value passing happens at **render time**, and subsequent updates are not automatically synced. For immutable config values like `duration`, this is perfectly fine.
:::

### Background Thread Passing Main Thread Functions

The easing curve is a **function** that needs to be called inside the main-thread RAF loop. Ordinary functions can't cross the thread boundary — but functions marked with `'main thread'` can.

Define the easing function with the `'main thread'` directive:

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

Receive and forward in the Swiper component:

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

Use in `useOffset`:

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
      duration, // BG value -> MT
      easing: MTEasing, // MT function -> MT
    });
  }
}
```

::: details Why use the main-thread-easing prefix?
When a prop's value is a **main-thread function**, it needs the `main-thread-` prefix in the name (in React, it uses the `main-thread:` colon prefix). This tells the SWC compiler that this value needs to be resolved on the main-thread side.

Without the prefix, the compiler treats it as an ordinary background-thread value and tries to serialize a function — which is not serializable, resulting in a runtime error.
:::

## Summary

Congratulations! You've built a high-performance product detail page with an image carousel. Let's review the core concepts learned:

- **Lynx layout**: `display: linear` + `linear-orientation: horizontal` for high-performance horizontal layout
- **Main Thread Script** (`'main thread'`): Run touch event handlers directly on the main thread, eliminating cross-thread latency
- **`useMainThreadRef`**: Create main-thread-readable/writable references, replacing background-thread `ref()`, accessed via `.current`
- **Vue composables**: Extract MTS logic into reusable modules like `useOffset`, `useUpdateSwiperStyle`, `useAnimate`
- **`runOnBackground`**: Main thread -> background thread function call bridge (indicator state sync)
- **`runOnMainThread`**: Background thread -> main thread function call bridge (tap-to-jump animation)
- **Cross-thread value passing**: Serializable background-thread values are automatically passed to main-thread functions; main-thread functions are passed via `main-thread-` prefixed props

The complete source code is in `packages/vue/e2e-lynx/src/swiper/`, with three progressive versions for reference.

::: info MTS Function Bodies Are Reusable Across Frameworks
An interesting discovery: all `'main thread'`-marked function bodies (`handleTouchStart`, `updateOffset`, `animate`, etc.) are **identical** between the Vue and React versions. The SWC compiler extracts these functions into a standalone main-thread bundle, independent of the framework.

This means you can directly reuse main-thread function logic from React Lynx examples — only the outer component syntax (SFC templates vs. JSX) needs to be adapted.
:::
