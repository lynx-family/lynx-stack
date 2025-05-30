import { createApp } from '@lynx-js/vue'

import { App } from './App.vue'

const app = createApp(App)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}

app.mount('#app')
