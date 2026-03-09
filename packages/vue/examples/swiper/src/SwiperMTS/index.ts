// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
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
