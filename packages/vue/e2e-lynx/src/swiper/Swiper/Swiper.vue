<!--
  Swiper (Full) — MTS touch handling + snap animation + indicator.

  Touch dragging: runs on Main Thread via 'main thread' directive (zero latency).
  Snap animation: requestAnimationFrame-based loop on MT (smooth easing).
  Indicator: BG-thread state updated via duplicate touch tracking. Indicator
  click → runOnMainThread to animate the swiper to the target page.
-->
<script setup lang="ts">
import { ref } from 'vue';
import { useMainThreadRef, runOnMainThread } from '@lynx-js/vue-runtime';
import SwiperItem from '../Components/SwiperItem.vue';
import Indicator from '../Components/Indicator.vue';

declare const SystemInfo: { pixelWidth: number; pixelRatio: number };

const props = withDefaults(defineProps<{
  data: string[];
  itemWidth?: number;
  duration?: number;
}>(), {
  itemWidth: () => SystemInfo.pixelWidth / SystemInfo.pixelRatio,
  duration: 300,
});

const dataLength = props.data.length;
const itemWidth = props.itemWidth;

// --- Main Thread refs ---
const containerRef = useMainThreadRef<unknown>(null);
const currentOffsetRef = useMainThreadRef<number>(0);
const touchStartXRef = useMainThreadRef<number>(0);
const touchStartOffsetRef = useMainThreadRef<number>(0);
const cancelAnimRef = useMainThreadRef<(() => void) | null>(null);

// --- Background Thread state for indicator ---
const currentIndex = ref(0);

// BG-side offset tracking (mirrors MT for indicator sync)
let bgOffset = 0;
let bgTouchStartX = 0;
let bgTouchStartOffset = 0;

// --- MTS helpers ---
function mtUpdateStyle(offset: number) {
  'main thread';
  const el = containerRef as unknown as {
    current?: { setStyleProperty?(k: string, v: string): void };
  };
  if (el.current?.setStyleProperty) {
    el.current.setStyleProperty('transform', `translateX(${offset}px)`);
  }
}

function mtUpdateOffset(offset: number) {
  'main thread';
  const lowerBound = 0;
  const upperBound = -(dataLength - 1) * itemWidth;
  const realOffset = Math.min(lowerBound, Math.max(upperBound, offset));
  currentOffsetRef.current = realOffset;
  mtUpdateStyle(realOffset);
}

// Easing function (runs on MT)
function easeInOutQuad(t: number) {
  'main thread';
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Snap animation (runs on MT via requestAnimationFrame)
function mtAnimate(from: number, to: number, duration: number) {
  'main thread';
  // Cancel any running animation
  if (cancelAnimRef.current) {
    cancelAnimRef.current();
  }

  let startTs = 0;
  let rafId = 0;

  function step(ts: number) {
    if (!startTs) startTs = Number(ts);
    const elapsed = ts - startTs;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutQuad(progress);
    const value = from + (to - from) * eased;
    mtUpdateOffset(value);
    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    }
  }

  rafId = requestAnimationFrame(step);
  cancelAnimRef.current = () => cancelAnimationFrame(rafId);
}

// --- MTS touch handlers ---
const handleTouchStart = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  touchStartXRef.current = e.touches[0].clientX;
  touchStartOffsetRef.current = currentOffsetRef.current;
  // Cancel running snap animation
  if (cancelAnimRef.current) {
    cancelAnimRef.current();
    cancelAnimRef.current = null;
  }
};

const handleTouchMove = (e: { touches: Array<{ clientX: number }> }) => {
  'main thread';
  const delta = e.touches[0].clientX - touchStartXRef.current;
  mtUpdateOffset(touchStartOffsetRef.current + delta);
};

const handleTouchEnd = () => {
  'main thread';
  // Snap to nearest page
  const nearestPage = Math.round(currentOffsetRef.current / itemWidth) * itemWidth;
  const lowerBound = 0;
  const upperBound = -(dataLength - 1) * itemWidth;
  const target = Math.min(lowerBound, Math.max(upperBound, nearestPage));
  mtAnimate(currentOffsetRef.current, target, 300);
  touchStartXRef.current = 0;
  touchStartOffsetRef.current = 0;
};

// --- BG touch handlers (duplicate tracking for indicator) ---
function onBGTouchStart(e: { touches?: Array<{ clientX?: number }> }) {
  bgTouchStartX = e.touches?.[0]?.clientX ?? 0;
  bgTouchStartOffset = bgOffset;
}

function onBGTouchMove(e: { touches?: Array<{ clientX?: number }> }) {
  const delta = (e.touches?.[0]?.clientX ?? 0) - bgTouchStartX;
  bgOffset = bgTouchStartOffset + delta;
  // Clamp and update indicator
  const lowerBound = 0;
  const upperBound = -(dataLength - 1) * itemWidth;
  bgOffset = Math.min(lowerBound, Math.max(upperBound, bgOffset));
  const index = Math.round(-bgOffset / itemWidth);
  if (currentIndex.value !== index) {
    currentIndex.value = index;
  }
}

function onBGTouchEnd() {
  // Snap to nearest page (mirrors MT logic)
  const nearestPage = Math.round(bgOffset / itemWidth) * itemWidth;
  const lowerBound = 0;
  const upperBound = -(dataLength - 1) * itemWidth;
  bgOffset = Math.min(lowerBound, Math.max(upperBound, nearestPage));
  const index = Math.round(-bgOffset / itemWidth);
  currentIndex.value = index;
}

// --- Indicator click → animate via runOnMainThread ---
function handleItemClick(index: number) {
  currentIndex.value = index;
  bgOffset = -index * itemWidth;
  runOnMainThread(mtAnimateToIndex)(index);
}

// MTS function called from BG via runOnMainThread
function mtAnimateToIndex(index: number) {
  'main thread';
  const target = -index * itemWidth;
  mtAnimate(currentOffsetRef.current, target, 300);
}
</script>

<template>
  <view class="swiper-wrapper">
    <view
      class="swiper-container"
      :main-thread-ref="containerRef"
      :main-thread-bindtouchstart="handleTouchStart"
      :main-thread-bindtouchmove="handleTouchMove"
      :main-thread-bindtouchend="handleTouchEnd"
      @touchstart="onBGTouchStart"
      @touchmove="onBGTouchMove"
      @touchend="onBGTouchEnd"
    >
      <SwiperItem
        v-for="(pic, index) in data"
        :key="index"
        :pic="pic"
        :item-width="itemWidth"
      />
    </view>
    <Indicator
      :total="data.length"
      :current="currentIndex"
      @item-click="handleItemClick"
    />
  </view>
</template>
