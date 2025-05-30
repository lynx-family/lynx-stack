# @lynx-js/vue

VueLynx is a framework for developing Lynx applications with familiar Vue 3.

# WIP

This is currently work in progress there is still some issue with :

- webpack plugin bundleling


## Features

- Full Vue 3 Composition API support
- Auto Thread splitting: template code in main thread, script code in background thread
- Hot Module Replacement (HMR)
- Vue Single File Components (SFC) support
- TypeScript support

## Installation

```bash
npm install @lynx-js/vue
# or
yarn add @lynx-js/vue
# or
pnpm add @lynx-js/vue
```

## Usage

```js
import { createApp } from "@lynx-js/vue";
import App from "./App.vue";

// Create the Vue app
const app = createApp(App);

// Mount the app
app.mount("#app");
```

## Auto Thread Splitting

VueLynx splits Vue components into two threads:

- **Main Thread**: Contains the template code and handles rendering
- **Background Thread**: Contains the script code and handles business logic

This separation allows for better performance and responsiveness in Lynx applications.

## Hot Module Replacement

VueLynx supports Hot Module Replacement (HMR) for a better development experience. When you make changes to your Vue components, they will be automatically updated without losing the current state.

## Vue Single File Components

VueLynx supports Vue Single File Components (SFC) with the familiar `.vue` file format:

```vue
<template>
  <div>
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="increment">Count: {{ count }}</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: "Hello VueLynx",
      message: "Welcome to Vue 3 in Lynx!",
      count: 0,
    };
  },
  methods: {
    increment() {
      this.count++;
    },
  },
};
</script>

<style>
h1 {
  color: #42b983;
}
</style>
```

## Composition API

VueLynx fully supports Vue 3's Composition API:

```vue
<template>
  <div>
    <h1>{{ title }}</h1>
    <p>{{ message }}</p>
    <button @click="increment">Count: {{ count }}</button>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";

const title = ref("Hello VueLynx");
const message = ref("Welcome to Vue 3 in Lynx!");
const count = ref(0);

function increment() {
  count.value++;
}
</script>
```

## License

Apache License 2.0
