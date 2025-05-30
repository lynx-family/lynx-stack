# @lynx-js/rspeedy-plugin-vue

A rsbuild plugin for VueLynx that provides integration with the Lynx platform.

## Features

- Split Vue's `<template>` code to main thread and `<script>` code to background thread
- Extract style code to main thread and inject CSS extract plugin
- Apply runtime code like hot module reload
- Support for Vue's Single File Components (SFC)

## Installation

```bash
npm install @lynx-js/rspeedy-plugin-vue
# or
yarn add @lynx-js/rspeedy-plugin-vue
# or
pnpm add @lynx-js/rspeedy-plugin-vue
```

## Usage

```js
import { defineConfig } from '@lynx-js/rspeedy'
import { pluginVueLynx } from '@lynx-js/rspeedy-plugin-vue'

export default defineConfig({
  plugins: [pluginVueLynx()],
})
```

## Configuration

The plugin accepts the following options:

```js
pluginVueLynx({
  // Compatibility options for VueLynx 2.0
  compat: {
    disableCompatibilityWarnings: false,
  },
  // CSS inheritance options
  enableCSSInheritance: false,
  customCSSInheritanceList: ['direction', 'color'],
  // Debug options
  debugInfoOutside: true,
  // Display options
  defaultDisplayLinear: true,
  // Accessibility options
  enableAccessibilityElement: false,
  // Internationalization options
  enableICU: false,
  // CSS options
  enableCSSInvalidation: true,
  enableCSSSelector: true,
  enableRemoveCSSScope: true,
  removeDescendantSelectorScope: false,
  // Gesture options
  enableNewGesture: false,
  // Threading options
  enableParallelElement: true,
  firstScreenSyncTiming: 'immediately', // or 'jsReady'
  // Pipeline options
  pipelineSchedulerConfig: 0x00010000,
  // Version options
  engineVersion: '1.0.0',
  // Experimental options
  experimental_isLazyBundle: false,
})
```

## License

Apache License 2.0
