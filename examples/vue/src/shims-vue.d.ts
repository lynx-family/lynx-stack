declare module '*.vue' {
  import type { Component } from '@lynx-js/vue-runtime';

  const component: Component;
  export default component;
}

declare module '*.png' {
  const src: string;
  export default src;
}
