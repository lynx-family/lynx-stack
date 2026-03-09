// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import '../gallery.css';
import { createApp, defineComponent, h } from '@lynx-js/vue-runtime';

import ImageCard from './ImageCard.vue';
import { furnituresPicturesSubArray } from '../Pictures/furnituresPictures.js';

// Wrapper that displays a single image card centered on screen
const App = defineComponent({
  setup() {
    const picture = furnituresPicturesSubArray[0]!;
    return () =>
      h(
        'view',
        { class: 'gallery-wrapper single-card' },
        [h(ImageCard, { picture })],
      );
  },
});

const app = createApp(App);
app.mount();
