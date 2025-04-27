# @lynx-js/react

## 0.106.5

### Patch Changes

- Fix `lynx.loadLazyBundle` is not a function ([#568](https://github.com/lynx-family/lynx-stack/pull/568))

- fix: flushDelayedLifecycleEvents stack overflow error ([#540](https://github.com/lynx-family/lynx-stack/pull/540))

## 0.106.4

### Patch Changes

- Disable MTS HMR functionality temporarily to address stability issues. This is a temporary fix while we work on a more robust solution. ([#512](https://github.com/lynx-family/lynx-stack/pull/512))

## 0.106.3

### Patch Changes

- Do some global var initialize in hydrate, which fixes error like `cannot read property '-21' of undefined` and some style issue. ([#461](https://github.com/lynx-family/lynx-stack/pull/461))

- fix: ensure ref lifecycle events run after firstScreen in the background thread ([#434](https://github.com/lynx-family/lynx-stack/pull/434))

  This patch fixes an issue where ref lifecycle events were running before firstScreen events in the background thread async render mode, which could cause refs to be undefined when components try to access them.

## 0.106.2

### Patch Changes

- fix: prevent multiple firstScreen events when reloading before `jsReady` ([#377](https://github.com/lynx-family/lynx-stack/pull/377))

- Optimize the bundle size by eliminating unnecessary code when the lazy bundle is not utilized. ([#284](https://github.com/lynx-family/lynx-stack/pull/284))

## 0.106.1

### Patch Changes

- Fix a stack underflow issue when running on PrimJS. ([#326](https://github.com/lynx-family/lynx-stack/pull/326))

## 0.106.0

### Minor Changes

- Improved rendering performance by batching updates sent to the main thread in a single render pass. This optimization reduces redundant layout operations on the main thread, accelerates rendering, and prevents screen flickering. ([#239](https://github.com/lynx-family/lynx-stack/pull/239))

  **BREAKING CHANGE**: This commit changes the behavior of Timing API. Previously, timing events were fired for each update individually. With the new batching mechanism, timing events related to the rendering pipeline will now be triggered once per render cycle rather than for each individual update, affecting applications that rely on the previous timing behavior.

### Patch Changes

- Add missing typing for `useErrorBoundary`. ([#263](https://github.com/lynx-family/lynx-stack/pull/263))

  You can now use `useErrorBoundary` it in TypeScript like this:

  ```tsx
  import { useErrorBoundary } from '@lynx-js/react';
  ```

- Modified the format of data sent from background threads to the main thread. ([#207](https://github.com/lynx-family/lynx-stack/pull/207))

- Support Lynx SSR. ([#60](https://github.com/lynx-family/lynx-stack/pull/60))

## 0.105.2

### Patch Changes

- Support new css properties: `offset-path` and `offset-distance` ([#152](https://github.com/lynx-family/lynx-stack/pull/152))

- Fix 'SystemInfo is not defined' error when using MTS and not importing anything manually from the react package. ([#172](https://github.com/lynx-family/lynx-stack/pull/172))

- Fix `not a function` error when using lazy bundle without MTS. ([#170](https://github.com/lynx-family/lynx-stack/pull/170))

- fix: gesture config not processed correctly ([#175](https://github.com/lynx-family/lynx-stack/pull/175))

  ```typescript
  const pan = Gesture.Pan().minDistance(100);
  ```

  After this commit, gesture config like `minDistance` should work as expected.

## 0.105.1

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

- feat: add compiler only version of addComponentElement, it does not support spread props but have no runtime overhead, use it by: ([#15](https://github.com/lynx-family/lynx-stack/pull/15))

  ```js
  pluginReactLynx({
    compat: {
      addComponentElement: {
        compilerOnly: true,
      },
    },
  });
  ```

- Fix error `createRef is not a function` ([#16](https://github.com/lynx-family/lynx-stack/pull/16))

- Support `MIXED` target for worklet, it will be used by unit testing frameworks, etc. ([#27](https://github.com/lynx-family/lynx-stack/pull/27))

- Support return value for `runOnBackground()` and `runOnMainThread()`. ([#119](https://github.com/lynx-family/lynx-stack/pull/119))

  Now you can get the return value from `runOnBackground()` and `runOnMainThread()`, which enables more flexible data flow between the main thread and the background thread.

  ```js
  import { runOnBackground } from '@lynx-js/react';

  const onTap = async () => {
    'main thread';
    const text = await runOnBackground(() => {
      'background only';
      return 'Hello, world!';
    })();
    console.log(text);
  };
  ```

## 0.105.0

### Minor Changes

- 1abf8f0: Support `estimated-main-axis-size-px`

  NOTE: This changes behavior of `transformReactLynx` so certain features (like lazy bundle) will be BROKEN if version mismatch.

- 1abf8f0: Support JSXSpread on `<list-item/>` component.

  NOTE: This changes behavior of `transformReactLynx` so certain features (like lazy bundle) will be BROKEN if version mismatch.

### Patch Changes

- 1abf8f0: Update readme.
- 1abf8f0: Save some bytes if `<page/>` is not used.
- 1abf8f0: Should escape newline character in jsx

## 0.104.1

### Patch Changes

- 9ce9ec0: Fix argument cannot be accessed correctly in default exported MTS functions.
- 99a4de6: Change TypeScript configuration to improve tree-shaking by setting `verbatimModuleSyntax: false`.

  This change allows the bundler to properly remove unused imports and type-only imports, resulting in smaller bundle sizes. For example:

  ```ts
  // These imports will be removed from the final bundle
  import type { Foo } from 'xyz';
  import { type Bar } from 'xyz';
  import { xyz } from 'xyz'; // When xyz is not used
  ```

  See [TypeScript - verbatimModuleSyntax](https://www.typescriptlang.org/tsconfig/#verbatimModuleSyntax) for details.

## 0.104.0

### Minor Changes

- 575e804: Remove misleading API `createRoot`

### Patch Changes

- 797ff68: Workaround the `cannot find module './snapshot/event.js'` error avoid tree-shaking `event.js` in development.
- 1bf9271: fix(react): default `compat` in transform to `false`

## 0.103.5

### Patch Changes

- 74e0ea3: Supports new `__MAIN_THREAD__` and `__BACKGROUND__` macro as an alternative to `__LEPUS__` and `__JS__`.

## 0.103.4

### Patch Changes

- 89a9f7a: Improve the speed of MTS.

## 0.103.3

### Patch Changes

- 4e94846: Fix variables being renamed in MTS.
- 297c6ea: Fix the issue that when `runOnBackground()`'s parameter is not legal, it will still report an error in the rendering process of the background thread even though it won't actually be called.

  ```tsx
  function App() {
    const f = undefined;

    function mts() {
      'main thread';
      // throws in background rendering
      f && runOnBackground(f)();
    }
  }
  ```

- 763ad4e: Stop reporting ctx id in the `ctx not found` error.
- 480611d: Avoid error from changing theme.
- 3bf5830: Avoid overriding `processEvalResult`.

## 0.103.2

### Patch Changes

- 580ce54: Fix snapshot not found in HMR updates.

## 0.103.1

### Patch Changes

- 80a4e38: Use hooks `useLynxGlobalEventListener` to make `useInitData` addListener as early as possible. This will fix the issue that `onDataChanged` has been called before the event listener is added.
- 8aa3979: Fix generating wrong JavaScript when using a variable multiple times in the main thread script.
- 318245e: Avoid snapshot ID conflict between different templates and bundles.
- b520862: Remove unnecessary sideEffects to reduce bundle size.
- 7cd840c: Integrate with `@lynx-js/types`.

## 0.103.0

### Minor Changes

- a30c83d: Add `compat.removeComponentAttrRegex`.

  ```js
  import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
  import { defineConfig } from '@lynx-js/rspeedy';

  export default defineConfig({
    plugins: [
      pluginReactLynx({
        compat: {
          removeComponentAttrRegex: 'YOUR REGEX',
        },
      }),
    ],
  });
  ```

  NOTE: This feature is deprecated and will be removed in the future. Use codemod instead.

- 5f8d492: Deprecate `compat.simplifyCtorLikeReactLynx2`

### Patch Changes

- ca3a639: Fix `cssId` collision issue when hash generated `@jsxCSSId` for jsx snapshot hit the range of auto increased cssId of `@file`.
- 8fbea78: Fix 'main thread' and 'background only' directives not working in export default declarations.
- ff18049: Bump swc_core v0.109.2.

  This would add `/*#__PURE__*/` to the output of TypeScript `enum`. See [swc-project/swc#9558](https://github.com/swc-project/swc/pull/9558) for details.

## 0.102.0

### Minor Changes

- e3be842: Fix some attribute updating of nodes in list does not take effect
- 2e6b549: Add ability to be compat with pre-0.99 version of ReactLynx

### Patch Changes

- 75725cb: Fix a memory leak in MTS.
- 09e0ec0: Reduce the size of `background.js`.
- 9e40f33: Slightly improve MTS execution speed.
- f24599e: Fix the infinite mount and unmount loops of lazy bundle when its JS file fails to execute.

## 0.101.0

### Minor Changes

- 6730c58: Change the snapshot transform result by adding `cssId` and `entryName`.

  <table>
    <thead>
      <tr>
        <th>Remove Scoped CSS(Default)</th>
        <th>Scoped CSS</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <pre><code>
  createSnapshot(
    $uid,
    $create,
    $update,
    $slot,
    /** cssId */ undefined,
    /** entryName */ globDynamicComponentEntry
  );
          </code></pre>
        </td>
        <td>
          <pre><code>
  createSnapshot(
    $uid,
    $create,
    $update,
    $slot,
    /** cssId */ 0x3da39a,
    /** entryName */ globDynamicComponentEntry
  );
          </code></pre>
        </td>
      </tr>
    </tbody>
  </table>

  This requires `@lynx-js/react-rsbuild-plugin` v0.5.1 to work.

  - Inject `globDynamicComponentEntry` for background script. ([#311](https://github.com/lynx-wg/lynx-stack/pull/311))
  - Inject `globDynamicComponentEntry` for main thread script. ([#312](https://github.com/lynx-wg/lynx-stack/pull/312))

- efbb7d4: Support Gesture.

  Gesture Handler is a set of gesture handling capabilities built on top of the Main Thread Script. It currently supports drag, inertial scrolling, long press, and tap gestures for `<view>`, `<scroll-view>`, `<list>`, and `<text>`. In the future, it will also support multi-finger zoom, multi-finger rotation, and other gesture capabilities.

  ```tsx
  import { useGesture, PanGesture } from '@lynx-js/gesture-runtime';

  function App() {
    const pan = useGesture(PanGesture);

    pan
      .onBegin((event, stateManager) => {
        'main thread';
        // some logic
      })
      .onUpdate((event, stateManager) => {
        'main thread';
        // some logic
      })
      .onEnd((event, stateManager) => {
        'main thread';
        // some logic
      });

    return <view main-thread:gesture={pan}></view>;
  }
  ```

### Patch Changes

- b2032eb: Better DCE.

  Now DCE can remove dead branch:

  ```ts
  function f() {
    if (__LEPUS__) {
      return;
    }

    console.log('not __LEPUS__'); // This can be removed now
  }
  ```

- 45edafa: Support using `import()` with variables.

## 0.100.0

### Minor Changes

- 587a782: Release `@lynx-js/react` v0.100.0

### Patch Changes

- a335490: Fix an issue where events might not fire after calling `ReloadTemplate`.
