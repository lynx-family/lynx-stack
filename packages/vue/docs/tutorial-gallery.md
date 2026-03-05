# Tutorial: Building a Gallery Page with Vue Lynx

In this tutorial, you'll build a gallery page step by step using Vue 3 and Lynx. By the end, you'll have a scrollable image gallery with a waterfall layout, tap-to-like interaction, and a smooth custom scrollbar powered by Main Thread Script.

## What We're Building

A furniture gallery app with:

- Image cards in a waterfall layout
- Tap-to-like interaction on each card
- Custom scrollbar that tracks scroll position
- Main Thread Script scrollbar for buttery-smooth performance

Each step builds on the previous one, progressively adding features.

---

## Step 1: Image Card Component

**Entry: `gallery-image-card`**

Let's start with the simplest possible component — an image card that displays a single picture.

### Picture Data

First, define the picture data. Each picture has a `src` URL, `width`, and `height`:

```ts
// gallery/Pictures/furnituresPictures.ts
export interface Picture {
  src: string;
  width: number;
  height: number;
}

export const furnituresPicturesSubArray: Picture[] = [
  { src: 'https://picsum.photos/seed/f0/512/429', width: 512, height: 429 },
  { src: 'https://picsum.photos/seed/f1/512/640', width: 512, height: 640 },
  // ... more entries
];
```

### ImageCard Component

The `ImageCard.vue` component accepts a `Picture` prop and displays it with proper aspect ratio:

```vue
<!-- gallery/ImageCard/ImageCard.vue -->
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';

const props = defineProps<{
  picture: Picture;
}>();

const aspectRatio = props.picture.height / props.picture.width;
</script>

<template>
  <view class="picture-wrapper">
    <image
      class="picture-image"
      :src="picture.src"
      :style="{ aspectRatio: String(1 / aspectRatio) }"
    />
  </view>
</template>
```

**Key concepts:**

- `defineProps<{ picture: Picture }>()` — TypeScript-typed component props
- `<image>` — Lynx's native image element (not HTML `<img>`)
- `:style` — Dynamic inline styles with Vue's binding syntax
- `class="..."` — CSS class selectors (enabled via `enableCSSSelector: true` in the plugin config)

### Entry Point

```ts
// gallery/ImageCard/index.ts
import '../gallery.css';
import { createApp, defineComponent, h } from '@lynx-js/vue-runtime';
import ImageCard from './ImageCard.vue';
import { furnituresPicturesSubArray } from '../Pictures/furnituresPictures';

const App = defineComponent({
  setup() {
    const picture = furnituresPicturesSubArray[0]!;
    return () =>
      h('view', { style: {/* centering styles */} }, [
        h('view', { style: { width: 200 } }, [
          h(ImageCard, { picture }),
        ]),
      ]);
  },
});

const app = createApp(App);
app.mount();
```

**Key concept:** `createApp(Component).mount()` is the Vue Lynx equivalent of React Lynx's `root.render(<App />)`.

---

## Step 2: Adding Interactivity — Like Button

**Entry: `gallery-like-card`**

Now let's add a tap-to-like heart icon overlay on the image card.

### LikeIcon Component

```vue
<!-- gallery/Components/LikeIcon.vue -->
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

const isLiked = ref(false);

function onTap() {
  isLiked.value = !isLiked.value;
}
</script>

<template>
  <view class="like-icon" @tap="onTap">
    <text :style="{ fontSize: 22, color: isLiked ? '#e74c3c' : '#ffffff' }">
      {{ isLiked ? '♥' : '♡' }}
    </text>
  </view>
</template>
```

**Key concepts:**

- `ref(false)` — Vue 3's reactive primitive (equivalent to React's `useState`)
- `@tap="onTap"` — Lynx tap event binding (equivalent to React's `bindtap={handler}`)
- `{{ isLiked ? '♥' : '♡' }}` — Template expression with conditional rendering
- When `isLiked.value` changes, Vue's reactivity system automatically re-renders

### LikeImageCard Component

```vue
<!-- gallery/Components/LikeImageCard.vue -->
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';
import LikeIcon from './LikeIcon.vue';

defineProps<{ picture: Picture }>();
</script>

<template>
  <view class="like-card">
    <image
      class="like-card-image"
      :src="picture.src"
      :style="{ aspectRatio: String(picture.width / picture.height) }"
    />
    <LikeIcon />
  </view>
</template>
```

The `LikeIcon` is positioned absolutely at the bottom-right of the card via CSS.

---

## Step 3: Gallery with `<list>` Waterfall Layout

**Entry: `gallery-list`**

Now let's display all the pictures in a 2-column waterfall layout using Lynx's native `<list>` element.

### Gallery Component

```vue
<!-- gallery/GalleryList/Gallery.vue -->
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
      span-count="2"
      scroll-orientation="vertical"
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

**Key concepts:**

- `<list>` with `list-type="waterfall"` — Lynx's native recycling list with waterfall layout
- `span-count="2"` — Two columns
- `v-for="(pic, i) in furnituresPictures"` — Vue's list rendering (equivalent to React's `arr.map()`)
- `:item-key` — Unique key for Lynx's list recycling
- `:estimated-main-axis-size-px` — Estimated height for pre-allocation (prevents layout jumps)

### Size Estimation Utility

```ts
// gallery/utils.ts
export function calculateEstimatedSize(
  originalWidth: number,
  originalHeight: number,
  columnWidth: number = 187.5,
  extraHeight: number = 40,
): string {
  const aspectRatio = originalHeight / originalWidth;
  const estimatedHeight = Math.round(columnWidth * aspectRatio + extraHeight);
  return String(estimatedHeight);
}
```

---

## Step 4: Custom Scrollbar (Background Thread)

**Entry: `gallery-scrollbar`**

Let's add a custom scrollbar that tracks scroll position. This version uses Background Thread events.

### NiceScrollbar Component

The scrollbar exposes an `adjustScrollbar` method via `defineExpose`:

```vue
<!-- gallery/GalleryScrollbar/NiceScrollbar.vue -->
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';

const scrollbarHeight = ref(0);
const scrollbarTop = ref(0);

function adjustScrollbar(
  scrollTop: number,
  scrollHeight: number,
  listHeight: number,
) {
  if (scrollHeight <= 0 || listHeight <= 0) return;
  const visibleRatio = listHeight / scrollHeight;
  const thumbH = Math.max(20, Math.round(600 * visibleRatio));
  const maxTop = 600 - thumbH;
  const scrollableDistance = scrollHeight - listHeight;
  const thumbTop = scrollableDistance > 0
    ? Math.round((scrollTop / scrollableDistance) * maxTop)
    : 0;
  scrollbarHeight.value = thumbH;
  scrollbarTop.value = thumbTop;
}

defineExpose({ adjustScrollbar });
</script>

<template>
  <view class="scrollbar-track">
    <view
      v-if="scrollbarHeight > 0"
      class="scrollbar-thumb"
      :style="{ height: `${scrollbarHeight}px`, top: `${scrollbarTop}px` }"
    />
  </view>
</template>
```

**Key concepts:**

- `defineExpose({ adjustScrollbar })` — Exposes methods to parent (equivalent to React's `forwardRef` + `useImperativeHandle`)
- `v-if="scrollbarHeight > 0"` — Conditional rendering (equivalent to React's `{condition && <el>}`)

### Gallery with Scroll Handler

```vue
<!-- gallery/GalleryScrollbar/Gallery.vue -->
<script setup lang="ts">
import { ref } from '@lynx-js/vue-runtime';
import NiceScrollbar from './NiceScrollbar.vue';
// ... other imports

const scrollbarRef = ref<InstanceType<typeof NiceScrollbar> | null>(null);

function onScroll(
  event: { detail?: { scrollTop?: number; scrollHeight?: number } },
) {
  const scrollTop = event.detail?.scrollTop ?? 0;
  const scrollHeight = event.detail?.scrollHeight ?? 0;
  scrollbarRef.value?.adjustScrollbar(scrollTop, scrollHeight, 600);
}
</script>

<template>
  <view class="gallery-wrapper">
    <list ... @scroll="onScroll">
      <!-- list items -->
    </list>
    <NiceScrollbar ref="scrollbarRef" />
  </view>
</template>
```

**Key concepts:**

- `@scroll="onScroll"` — Lynx scroll event (runs on Background Thread)
- `ref<InstanceType<typeof NiceScrollbar>>` — Typed template ref for accessing exposed methods
- The scroll handler crosses threads: scroll event → BG thread → update state → send ops → MT thread → render. This introduces visible latency.

---

## Step 5: Smooth Scrollbar with Main Thread Script

**Entry: `gallery-complete`**

The Background Thread scrollbar has noticeable lag because each scroll event crosses threads twice. Main Thread Script (MTS) eliminates this by running the scroll handler directly on the Main Thread.

### NiceScrollbarMTS Component

```vue
<!-- gallery/GalleryComplete/NiceScrollbarMTS.vue -->
<script setup lang="ts">
import type { MainThreadRef } from '@lynx-js/vue-runtime';

defineProps<{
  thumbRef: MainThreadRef;
}>();
</script>

<template>
  <view class="scrollbar-track">
    <view
      class="scrollbar-thumb"
      :main-thread-ref="thumbRef"
      :style="{ height: '60px', top: '0px' }"
    />
  </view>
</template>
```

**Key concepts:**

- `:main-thread-ref="thumbRef"` — Binds a `MainThreadRef` to the element, allowing the Main Thread to directly manipulate it
- The thumb's initial styles are set via `:style`, but subsequent updates come from Main Thread `setStyleProperty` calls

### Gallery with MTS Scroll Handler

```vue
<!-- gallery/GalleryComplete/Gallery.vue -->
<script setup lang="ts">
import { useMainThreadRef } from '@lynx-js/vue-runtime';
import NiceScrollbarMTS from './NiceScrollbarMTS.vue';

const scrollbarThumbRef = useMainThreadRef(null);

// Hand-crafted worklet context (Phase 1)
const onScrollMTSCtx = {
  _wkltId: 'gallery:adjustScrollbarMTS',
  _workletType: 'main-thread',
  _c: {} as Record<string, unknown>,
};

// Stamp the ref's _wvid into the closure
onScrollMTSCtx._c = { _thumbRef: scrollbarThumbRef.toJSON() };
</script>

<template>
  <view class="gallery-wrapper">
    <list ... :main-thread-bindscroll="onScrollMTSCtx">
      <!-- list items -->
    </list>
    <NiceScrollbarMTS :thumb-ref="scrollbarThumbRef" />
  </view>
</template>
```

**Key concepts:**

- `useMainThreadRef(null)` — Creates a ref that can be resolved on the Main Thread (same API as React Lynx)
- `:main-thread-bindscroll="ctx"` — Binds a worklet handler to the scroll event (runs on Main Thread with zero thread crossings)
- `.toJSON()` — Serializes the ref for cross-thread transfer (includes `_wvid`)
- The worklet reads `event.detail.scrollTop/scrollHeight` and calls `setStyleProperty('height', ...)` and `setStyleProperty('top', ...)` directly on the thumb element

### Worklet Registration (entry-main.ts)

The worklet function is registered on the Main Thread:

```ts
registerWorkletInternal(
  'main-thread',
  'gallery:adjustScrollbarMTS',
  function(event) {
    const scrollTop = event.detail?.scrollTop ?? 0;
    const scrollHeight = event.detail?.scrollHeight ?? 1;

    // Calculate thumb position and height
    const thumbH = Math.max(20, Math.round(600 * (600 / scrollHeight)));
    const maxTop = 600 - thumbH;
    const thumbTop = scrollableDistance > 0
      ? Math.round((scrollTop / scrollableDistance) * maxTop)
      : 0;

    // Resolve ref and update directly
    const refEntry = impl._refImpl._workletRefMap[wvid];
    refEntry.current.setStyleProperty('height', `${thumbH}px`);
    refEntry.current.setStyleProperty('top', `${thumbTop}px`);
  },
);
```

This is Phase 1 (hand-crafted). In Phase 2, the SWC transform will generate worklet contexts automatically from `<script main-thread>` blocks.

---

## React vs Vue Quick Reference

| Concept          | React Lynx                           | Vue Lynx                        |
| ---------------- | ------------------------------------ | ------------------------------- |
| Create app       | `root.render(<App />)`               | `createApp(App).mount()`        |
| State            | `useState(val)`                      | `ref(val)`                      |
| Template ref     | `useRef(null)`                       | `ref(null)`                     |
| Lifecycle        | `useEffect(() => ..., [])`           | `onMounted(() => ...)`          |
| Class name       | `className="foo"`                    | `class="foo"`                   |
| Conditional      | `{cond && <el>}`                     | `v-if="cond"`                   |
| List             | `arr.map(x => <el>)`                 | `v-for="x in arr"`              |
| Tap event        | `bindtap={handler}`                  | `@tap="handler"`                |
| Scroll event     | `bindscroll={handler}`               | `@scroll="handler"`             |
| MTS scroll       | `main-thread:bindscroll={fn}`        | `:main-thread-bindscroll="ctx"` |
| MTS ref          | `main-thread:ref={ref}`              | `:main-thread-ref="ref"`        |
| MT ref hook      | `useMainThreadRef(null)`             | `useMainThreadRef(null)`        |
| Expose to parent | `forwardRef` + `useImperativeHandle` | `defineExpose`                  |

---

## Running the Examples

```bash
# Build dependencies first
cd packages/vue/main-thread && pnpm build

# Start the dev server
cd packages/vue/e2e-lynx && pnpm dev
```

Then open each bundle in LynxExplorer:

- `gallery-image-card.lynx.bundle` — Single image card
- `gallery-like-card.lynx.bundle` — Card with like button
- `gallery-list.lynx.bundle` — Waterfall grid
- `gallery-scrollbar.lynx.bundle` — Gallery with BG scrollbar
- `gallery-complete.lynx.bundle` — Gallery with MTS scrollbar

---

## What's Next

- **Phase 2 MTS**: Once the SWC worklet transform is integrated, you'll be able to write `<script main-thread>` blocks directly in Vue SFCs instead of hand-crafting worklet contexts.
- **Auto-scroll**: When Vue Lynx adds `invoke()` support on element refs, the gallery can implement auto-scrolling.
- **Real images**: Replace the picsum.photos URLs with actual furniture images for production use.
