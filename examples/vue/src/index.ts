import { createApp } from '@lynx-js/vue';
// @ts-ignore - Import Vue file
import { App } from './App.vue';

const app = createApp(App);

// Remove hot reload code that might be causing issues
// if (import.meta.webpackHot) {
//   import.meta.webpackHot.accept();
// }

app.mount('#app');
