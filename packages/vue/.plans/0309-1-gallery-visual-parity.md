# Vue Gallery — Visual/Functional Parity with React Original

## Context

The Vue gallery tutorial entries are functionally working but visually diverge from the React original (`lynx-family/lynx-examples/examples/Gallery`). The user asked to **reuse all CSS and replicate its functionalities and UI with fidelity**. This plan updates every gallery file to match the React original's styling, structure, and behavior exactly.

React source (cloned): `/Users/bytedance/github/lynx-examples/examples/Gallery/src/`

## Changes Summary

### 1. Replace `gallery.css` with React's exact SCSS (as plain CSS)

**File**: `e2e-lynx/src/gallery/gallery.css`

Replace entirely with the React `index.scss` content (SCSS is valid CSS here — no nesting/mixins used):

```css
.gallery-wrapper {
  height: 100vh;
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
  width: 100vw;
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

Remove old classes: `.like-card`, `.scrollbar-track`, `.scrollbar-thumb`, `.scrollbar-glow`.

### 2. Copy heart PNG images from React source

**Action**: Copy `redHeart.png` and `whiteHeart.png` from React source to Vue gallery:

```
cp /Users/bytedance/github/lynx-examples/examples/Gallery/src/Pictures/redHeart.png \
   packages/vue/e2e-lynx/src/gallery/Pictures/
cp /Users/bytedance/github/lynx-examples/examples/Gallery/src/Pictures/whiteHeart.png \
   packages/vue/e2e-lynx/src/gallery/Pictures/
```

### 3. Update `furnituresPictures.ts` — match React's exact dimensions

**File**: `e2e-lynx/src/gallery/Pictures/furnituresPictures.ts`

Update dimensions to match React's exact values (React uses local PNGs; we keep picsum URLs but with correct W×H):

```
pic0:  512×429  →  keep
pic1:  511×437  →  update (was 512×640)
pic2:  1024×1589 → update (was 512×384)
pic3:  510×418  →  update (was 512×512)
pic4:  509×438  →  update (was 512×341)
pic5:  1024×1557 → update (was 512×682)
pic6:  509×415  →  update (was 512×455)
pic7:  509×426  →  update (was 512×576)
pic8:  1024×1544 → update (was 512×400)
pic9:  510×432  →  update (was 512×614)
pic10: 1024×1467 → update (was 512×480)
pic11: 1024×1545 → update (was 512×550)
pic12: 512×416  →  update (was 512×370)
pic13: 1024×1509 → update (was 512×600)
pic14: 512×411  →  update (was 512×460)
```

### 4. Update `LikeIcon.vue` — heart images + ripple + one-way toggle

**File**: `e2e-lynx/src/gallery/Components/LikeIcon.vue`

Replace unicode hearts with imported PNG images. Add ripple circle views. Make toggle one-way (white→red only, matching React).

```vue
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

### 5. Update `LikeImageCard.vue` — use `.picture-wrapper` class

**File**: `e2e-lynx/src/gallery/Components/LikeImageCard.vue`

Change class from `.like-card` to `.picture-wrapper` (matching React). Remove old margin/white-bg styles.

```vue
<script setup lang="ts">
import type { Picture } from '../Pictures/furnituresPictures';
import LikeIcon from './LikeIcon.vue';
defineProps<{ picture: Picture }>();
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

### 6. Update `ImageCard.vue` — use `.picture-wrapper` class

**File**: `e2e-lynx/src/gallery/ImageCard/ImageCard.vue`

Match React's ImageCard structure exactly (class `picture-wrapper`, same style binding).

### 7. Update `ImageCard/index.ts` — use `.gallery-wrapper.single-card`

**File**: `e2e-lynx/src/gallery/ImageCard/index.ts`

Render wrapper with `class="gallery-wrapper single-card"` (black bg, centered) instead of inline light-gray styles.

### 8. Update `LikeCard/index.ts` — same `.gallery-wrapper.single-card`

**File**: `e2e-lynx/src/gallery/LikeCard/index.ts`

Same wrapper change as ImageCard.

### 9. Update `utils.ts` — use `SystemInfo` for dynamic width

**File**: `e2e-lynx/src/gallery/utils.ts`

Match React's exact calculation using `SystemInfo.pixelWidth / SystemInfo.pixelRatio`:

```ts
declare const SystemInfo: { pixelWidth: number; pixelRatio: number };
export const calculateEstimatedSize = (
  pictureWidth: number,
  pictureHeight: number,
): string => {
  const galleryPadding = 20;
  const galleryMainAxisGap = 10;
  const gallerySpanCount = 2;
  const galleryWidth = SystemInfo.pixelWidth / SystemInfo.pixelRatio;
  const itemWidth = (galleryWidth - galleryPadding * 2 - galleryMainAxisGap)
    / gallerySpanCount;
  return String(Math.round(itemWidth / pictureWidth * pictureHeight));
};
```

### 10. Update all Gallery.vue templates — match React's list attributes

**Files**: `GalleryList/Gallery.vue`, `GalleryScrollbar/Gallery.vue`, `GalleryComplete/Gallery.vue`

Changes common to all:

- Use `:column-count="2"` instead of `:span-count="2"` (matching React)
- Add `custom-list-name="list-container"`
- Remove `flex: 1` styling (CSS `.list` now has `height: calc(100% - 48px)`)
- Update `calculateEstimatedSize` calls (now returns string, takes only width+height)

### 11. Update `NiceScrollbar.vue` — use React's class structure

**File**: `e2e-lynx/src/gallery/GalleryScrollbar/NiceScrollbar.vue`

Replace `.scrollbar-track`/`.scrollbar-thumb` with `.scrollbar`/`.scrollbar-effect.glow`. Use `SystemInfo` for listHeight.

```vue
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

### 12. Update `NiceScrollbarMTS.vue` — match React structure

**File**: `e2e-lynx/src/gallery/GalleryComplete/NiceScrollbarMTS.vue`

Use `.scrollbar` class + `.scrollbar-effect.glow` child (matching React). Remove `.scrollbar-track` wrapper.

### 13. Update `entry-main.ts` worklet — use `SystemInfo` for listHeight

**File**: `main-thread/src/entry-main.ts`

Update `gallery:adjustScrollbarMTS` to use `SystemInfo.pixelHeight / SystemInfo.pixelRatio - 48` for listHeight instead of hardcoded 600.

### 14. Update `GalleryScrollbar/Gallery.vue` — use `SystemInfo` for listHeight

Remove hardcoded `600` parameter from `adjustScrollbar` call. The `NiceScrollbar.vue` component now calculates listHeight internally.

## Files Modified (complete list)

| File                                                        | Action                                   |
| ----------------------------------------------------------- | ---------------------------------------- |
| `e2e-lynx/src/gallery/gallery.css`                          | Replace with React's exact CSS           |
| `e2e-lynx/src/gallery/Pictures/redHeart.png`                | Copy from React source                   |
| `e2e-lynx/src/gallery/Pictures/whiteHeart.png`              | Copy from React source                   |
| `e2e-lynx/src/gallery/Pictures/furnituresPictures.ts`       | Update dimensions to match React         |
| `e2e-lynx/src/gallery/Components/LikeIcon.vue`              | PNG hearts + ripple circles + one-way    |
| `e2e-lynx/src/gallery/Components/LikeImageCard.vue`         | Use `.picture-wrapper` class             |
| `e2e-lynx/src/gallery/ImageCard/ImageCard.vue`              | Use `.picture-wrapper` class             |
| `e2e-lynx/src/gallery/ImageCard/index.ts`                   | Use `.gallery-wrapper.single-card`       |
| `e2e-lynx/src/gallery/LikeCard/index.ts`                    | Use `.gallery-wrapper.single-card`       |
| `e2e-lynx/src/gallery/utils.ts`                             | Use `SystemInfo` for dynamic width       |
| `e2e-lynx/src/gallery/GalleryList/Gallery.vue`              | Match React list attrs + class structure |
| `e2e-lynx/src/gallery/GalleryScrollbar/Gallery.vue`         | Match React, remove hardcoded height     |
| `e2e-lynx/src/gallery/GalleryScrollbar/NiceScrollbar.vue`   | React class structure + SystemInfo       |
| `e2e-lynx/src/gallery/GalleryComplete/Gallery.vue`          | Match React list attrs                   |
| `e2e-lynx/src/gallery/GalleryComplete/NiceScrollbarMTS.vue` | React class structure                    |
| `main-thread/src/entry-main.ts`                             | Use SystemInfo in MTS scrollbar worklet  |

## Scope Exclusions

- **Auto-scroll** (`useRef.invoke()`): Still skipped — Vue Lynx doesn't support this yet
- **AddAutoScroll / ScrollbarCompare entries**: Not added (require invoke API)
- **Local PNG furniture images**: Keep picsum.photos URLs but use React's exact W×H ratios
- **SCSS dependency**: Not added — React's SCSS is valid plain CSS (no nesting)

## Verification

1. `pnpm build` in `packages/vue/main-thread` (updated worklet)
2. `pnpm dev` in `packages/vue/e2e-lynx` — all entries build clean
3. Open in LynxExplorer:
   - `gallery-image-card` — **black background**, centered card with 10px border-radius
   - `gallery-like-card` — heart icon **top-right 48×48**, white PNG → red PNG on tap, ripple animation circles
   - `gallery-list` — **black background**, 20px padding, 10px gaps between items
   - `gallery-scrollbar` — **gradient scrollbar** (red→blue→teal) with **glow box-shadow**, animated shine
   - `gallery-complete` — MTS scrollbar with same gradient/glow styling
4. No console errors in DevTool
