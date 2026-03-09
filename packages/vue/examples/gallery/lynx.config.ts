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
      'gallery-image-card': './src/ImageCard/index.ts',
      'gallery-like-card': './src/LikeCard/index.ts',
      'gallery-list': './src/GalleryList/index.ts',
      'gallery-autoscroll': './src/GalleryAutoScroll/index.ts',
      'gallery-scrollbar': './src/GalleryScrollbar/index.ts',
      'gallery-scrollbar-compare': './src/GalleryScrollbarCompare/index.ts',
      'gallery-complete': './src/GalleryComplete/index.ts',
    },
  },
  plugins: [
    pluginVueLynx({
      optionsApi: false,
      enableCSSSelector: true,
    }),
  ],
});
