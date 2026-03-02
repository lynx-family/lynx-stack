// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Vue-Lynx dual-thread MVP demo.
 *
 * Validates the full pipeline:
 *   BG Thread: Vue reactive system → nodeOps → ops buffer → callLepusMethod
 *   Main Thread: applyOps → PAPI calls → native render
 *
 * Features exercised:
 *   - Static render (h('text', null, 'Hello'))
 *   - Reactive counter (ref + update → BG sends only SET_TEXT op)
 *   - Event handling (bindtap → sign → publishEvent → handler on BG)
 */

import {
  createApp,
  defineComponent,
  h,
  onMounted,
  ref,
} from '@lynx-js/vue-runtime'

const Counter = defineComponent({
  name: 'Counter',
  setup() {
    const count = ref(0)

    onMounted(() => {
      // Auto-increment every 2 s to verify reactive updates work without user input
      setInterval(() => {
        count.value++
      }, 2000)
    })

    return () =>
      h(
        'view',
        { style: { display: 'flex', flexDirection: 'column', padding: 16 } },
        [
          h('text', { style: { fontSize: 24, color: '#333' } }, [
            `Count: ${count.value}`,
          ]),
          h(
            'view',
            {
              style: {
                marginTop: 12,
                padding: '8px 16px',
                backgroundColor: '#0077ff',
                borderRadius: 8,
              },
              bindtap: () => {
                count.value++
              },
            },
            [h('text', { style: { color: '#fff' } }, ['Tap to increment'])],
          ),
        ],
      )
  },
})

const App = defineComponent({
  name: 'App',
  setup() {
    return () =>
      h('view', { style: { flex: 1 } }, [
        h('text', { style: { fontSize: 18, margin: 16 } }, [
          'Vue 3 × Lynx – Dual-Thread MVP',
        ]),
        h(Counter),
      ])
  },
})

const app = createApp(App)
app.mount()
