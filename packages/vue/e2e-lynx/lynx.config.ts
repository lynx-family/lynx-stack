// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@lynx-js/rspeedy';
import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin';

export default defineConfig({
  environments: {
    web: {},
    lynx: {},
  },
  source: {
    entry: {
      main: './src/index.ts',
      'h-counter': './src/h-counter.ts',
      todomvc: './src/todomvc/index.ts',
      'mts-draggable': './src/mts-draggable/index.ts',
      // Gallery tutorial entries (progressive)
      'gallery-image-card': './src/gallery/ImageCard/index.ts',
      'gallery-like-card': './src/gallery/LikeCard/index.ts',
      'gallery-list': './src/gallery/GalleryList/index.ts',
      'gallery-autoscroll': './src/gallery/GalleryAutoScroll/index.ts',
      'gallery-scrollbar': './src/gallery/GalleryScrollbar/index.ts',
      'gallery-scrollbar-compare':
        './src/gallery/GalleryScrollbarCompare/index.ts',
      'gallery-complete': './src/gallery/GalleryComplete/index.ts',
      // Swiper tutorial entries (progressive: static → MTS → full)
      'swiper-empty': './src/swiper/SwiperEmpty/index.ts',
      'swiper-mts': './src/swiper/SwiperMTS/index.ts',
      swiper: './src/swiper/Swiper/index.ts',
    },
  },
  plugins: [
    pluginVueLynx({
      optionsApi: false,
      enableCSSSelector: true,
    }),
  ],
});
