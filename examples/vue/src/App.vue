<script setup lang="ts">
import { ref, onMounted } from '@lynx-js/vue-runtime'

import './App.css'
import arrow from './assets/arrow.png'
import lynxLogo from './assets/lynx-logo.png'
import vueLogo from './assets/vue-logo.png'
import { useFlappy } from './useFlappy.js'

const alterLogo = ref(false)
const { y: logoY, jump } = useFlappy()

onMounted(() => {
  console.info('Hello, Vue Lynx')
})

function onTap() {
  alterLogo.value = !alterLogo.value
}
</script>

<template>
  <view @tap="jump">
    <view class="Background" />
    <view class="App">
      <view class="Banner">
        <view
          class="Logo"
          :style="{ transform: `translateY(${logoY}px)` }"
          @tap="onTap"
        >
          <image
            :src="alterLogo ? vueLogo : lynxLogo"
            :class="alterLogo ? 'Logo--vue' : 'Logo--lynx'"
          />
        </view>
        <text class="Title">Vue</text>
        <text class="Subtitle">on Lynx</text>
      </view>
      <view class="Content">
        <image :src="arrow" class="Arrow" />
        <text class="Description">Tap the logo and have fun!</text>
        <text class="Hint">
          Edit<text
            :style="{
              fontStyle: 'italic',
              color: 'rgba(255, 255, 255, 0.85)',
            }"
          >{{ ' src/App.vue ' }}</text>to see updates!
        </text>
      </view>
      <view :style="{ flex: 1 }" />
    </view>
  </view>
</template>
