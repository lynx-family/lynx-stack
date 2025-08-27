# @lynx-js/react

## 0.112.4

### Patch Changes

- fix `withInitDataInState` got wrong state in 2nd or more times `defaultDataProcessor`, now it will keep its own state. ([#1478](https://github.com/lynx-family/lynx-stack/pull/1478))

- change `__CreateElement('raw-text')` to `__CreateRawText('')` to avoid `setNativeProps` not working ([#1570](https://github.com/lynx-family/lynx-stack/pull/1570))

- Fix wrong render result when using expression as `key`. ([#1541](https://github.com/lynx-family/lynx-stack/pull/1541))

  See [lynx-family/lynx-stack#1371](https://github.com/lynx-family/lynx-stack/issues/1371) for more details.

- fix: `Cannot read properties of undefined` error when using `Suspense` ([#1569](https://github.com/lynx-family/lynx-stack/pull/1569))

- Add `animate` API in Main Thread Script(MTS), so you can now control a CSS animation imperatively ([#1534](https://github.com/lynx-family/lynx-stack/pull/1534))

  ```ts
  import type { MainThread } from '@lynx-js/types';

  function startAnimation(ele: MainThread.Element) {
    'main thread';
    const animation = ele.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 3000,
    });

    // Can also be paused
    // animation.pause()
  }
  ```

## 0.112.3

### Patch Changes

- fix css transform error in testing library ([#1500](https://github.com/lynx-family/lynx-stack/pull/1500))

- fix the type error of `wrapper` option in testing library's `render` and `renderHook` function ([#1502](https://github.com/lynx-family/lynx-stack/pull/1502))

- Introduce recursive hydration for lists to prevent double remove/insert on moves. ([#1401](https://github.com/lynx-family/lynx-stack/pull/1401))

- Handle `<frame/>` correctly. ([#1497](https://github.com/lynx-family/lynx-stack/pull/1497))

## 0.112.2

### Patch Changes

- Supports `recyclable` attribute in `<list-item>` to control whether the list item is recyclable. The `recyclable` attribute depends on Lynx Engine 3.4 or later. ([#1388](https://github.com/lynx-family/lynx-stack/pull/1388))

  ```jsx
  <list-item recyclable={false} />;
  ```

- feat: Support using a host element as direct child of Suspense ([#1455](https://github.com/lynx-family/lynx-stack/pull/1455))

- Add profile in production build: ([#1336](https://github.com/lynx-family/lynx-stack/pull/1336))

  1. `diff:__COMPONENT_NAME__`: how long ReactLynx diff took.
  2. `render:__COMPONENT_NAME__`: how long your render function took.
  3. `setState`: an instant trace event, indicate when your setState was called.

  NOTE: `__COMPONENT_NAME__` may be unreadable when minified, setting `displayName` may help.

- Add `onBackgroundSnapshotInstanceUpdateId` event on dev for Preact Devtools to keep the correct snapshotInstanceId info. ([#1173](https://github.com/lynx-family/lynx-stack/pull/1173))

- fix: Prevent error when spreading component props onto an element ([#1459](https://github.com/lynx-family/lynx-stack/pull/1459))

- fix: Correctly check for the existence of background functions in MTS ([#1416](https://github.com/lynx-family/lynx-stack/pull/1416))

  ```ts
  function handleTap() {
    'main thread';
    // The following check always returned false before this fix
    if (myHandleTap) {
      runOnBackground(myHandleTap)();
    }
  }
  ```

## 0.112.1

### Patch Changes

- Fix crash caused by not removing event listeners during destroy. ([#1379](https://github.com/lynx-family/lynx-stack/pull/1379))

- Fix missing "type" in "update-list-info" in hydrate ([#1392](https://github.com/lynx-family/lynx-stack/pull/1392))

## 0.112.0

### Minor Changes

- feat: Force synchronous rendering for background initial renders to support Suspense fallbacks ([#1323](https://github.com/lynx-family/lynx-stack/pull/1323))

- Introduces `@lynx-js/react/compat` submodule exporting Preact implementations of: ([#1316](https://github.com/lynx-family/lynx-stack/pull/1316))

  - `startTransition`
  - `useTransition`

### Patch Changes

- fix: Ensure useEffect callbacks execute before event handlers from the same render cycle ([#1348](https://github.com/lynx-family/lynx-stack/pull/1348))

- Enable rendering of the `Suspense` fallback on initial render. ([#1285](https://github.com/lynx-family/lynx-stack/pull/1285))

- fix: Prevent "cannot set property 'current' of undefined" error thrown by MainThreadRef on engine data updates ([#1342](https://github.com/lynx-family/lynx-stack/pull/1342))

## 0.111.2

### Patch Changes

- Optimize `componentAtIndex` by a few hundreds microseconds: avoiding manipulate `__pendingListUpdates` unless SnapshotInstance tree is changed ([#1201](https://github.com/lynx-family/lynx-stack/pull/1201))

- Support alog of component rendering on production for better error reporting. Enable it by using `REACT_ALOG=true rspeedy dev/build` or defining `__ALOG__` to `true` in `lynx.config.js`: ([#1164](https://github.com/lynx-family/lynx-stack/pull/1164))

  ```js
  export default defineConfig({
    // ...
    source: {
      define: {
        __ALOG__: true,
      },
    },
  });
  ```

- Make `preact/debug` work with `@lynx-js/react`. ([#1222](https://github.com/lynx-family/lynx-stack/pull/1222))

- Introduce `@lynx-js/react/debug` which would include debugging warnings and error messages for common mistakes found. ([#1250](https://github.com/lynx-family/lynx-stack/pull/1250))

  Add the import to `@lynx-js/react/debug` at the first line of the entry:

  ```js
  import '@lynx-js/react/debug';
  import { root } from '@lynx-js/react';

  import { App } from './App.jsx';

  root.render(<App />);
  ```

- `<list-item/>` deferred now accepts an object with `unmountRecycled` property to control unmounting behavior when the item is recycled. ([#1302](https://github.com/lynx-family/lynx-stack/pull/1302))

  For example, you can use it like this:

  ```jsx
  <list-item defer={{ unmountRecycled: true }} item-key='1'>
    <WillBeUnmountIfRecycled />
  </list-item>;
  ```

  Now the component will be unmounted when it is recycled, which can help with performance in certain scenarios.

- Avoid some unexpected `__SetAttribute` in hydrate when `undefined` is passed as an attribute value to intrinsic elements, for example: ([#1318](https://github.com/lynx-family/lynx-stack/pull/1318))

  ```jsx
  <image async-mode={undefined} />;
  ```

## 0.111.1

### Patch Changes

- Wrap the main thread `renderPage` in preact `act` to ensure that the effects are flushed. ([#1170](https://github.com/lynx-family/lynx-stack/pull/1170))

## 0.111.0

### Minor Changes

- Allow some `<list-item/>`s to be deferred and rendered in the background thread. ([#204](https://github.com/lynx-family/lynx-stack/pull/204))

  Use the following syntax:

  ```diff
  <list>
  -  <list-item item-key="...">
  +  <list-item item-key="..." defer>
        <SomeHeavyComponent />
    </list-item>
  </list>
  ```

  You should render your heavyweight components with the `defer` attribute to avoid blocking the main thread.

### Patch Changes

- Add missing alias of `@lynx-js/react` and `preact` in testing library, it will fix the `Failed to resolve import "@lynx-js/react/internal"` error in node_modules. ([#1182](https://github.com/lynx-family/lynx-stack/pull/1182))

- Allow any types of `dataProcessors` in `lynx.registerDataProcessors`. ([#1200](https://github.com/lynx-family/lynx-stack/pull/1200))

- Make `loadLazyBundle` being able to render the content on the first screen of the background thread. ([#1212](https://github.com/lynx-family/lynx-stack/pull/1212))

- Fixed: An issue where the `lynxViewDidUpdate` callback did not trigger when data was updated from native. ([#1171](https://github.com/lynx-family/lynx-stack/pull/1171))

  Notice:

  - Even if no data changes are actually processed after calling `updateData()`, the `lynxViewDidUpdate` callback will still be triggered.
  - Only one `lynxViewDidUpdate` callback will be triggered per render cycle. Consequently, if multiple `updateData()` calls are made within a single cycle but the data updates are batched, the number of `lynxViewDidUpdate` callbacks triggered may be less than the number of `updateData()` calls.

- Supports `act` in testing library. ([#1182](https://github.com/lynx-family/lynx-stack/pull/1182))

  ```js
  import { act } from '@lynx-js/react/testing-library';

  act(() => {
    // ...
  });
  ```

## 0.110.1

### Patch Changes

- Fix a memory leak when using `<list/>`. ([#1144](https://github.com/lynx-family/lynx-stack/pull/1144))

## 0.110.0

### Minor Changes

- Fixed closure variable capture issue in effect hooks to prevent stale values and ensured proper execution order between refs, effects, and event handlers. ([#770](https://github.com/lynx-family/lynx-stack/pull/770))

  **Breaking Changes**:

  - The execution timing of `ref`, `useEffect()` callback, `componentDidMount`, `componentDidUpdate`, `componentWillUnmount` and the callback of `setState` have been moved forward. These effects will now execute before hydration is complete, rather than waiting for the main thread update to complete.
  - For components inside `<list />`, `ref` callbacks will now be triggered during background thread rendering, regardless of component visibility. If your code depends on component visibility timing, use `main-thread:ref` instead of regular `ref`.

### Patch Changes

- Fixed two memory leaks: ([#1071](https://github.com/lynx-family/lynx-stack/pull/1071))

  1. When JSX is rendered on the main thread and removed, FiberElement can still be referenced by `__root.__jsx` through `props.children`;

  2. When the SnapshotInstance tree is removed from the root node, its child nodes form a cycle reference because the `__previousSibling` and `__nextSibling` properties point to each other, thus causing a FiberElement leak.

- Optimize the error message when snapshots cannot be found in the main thread. ([#1083](https://github.com/lynx-family/lynx-stack/pull/1083))

- Fix a problem causing `MainThreadRef`s to not be updated correctly during hydration when they are set to `main-thread:ref`s. ([#1001](https://github.com/lynx-family/lynx-stack/pull/1001))

- Add snapshot id report when throwing `snapshotPatchApply failed: ctx not found` error. ([#1107](https://github.com/lynx-family/lynx-stack/pull/1107))

- Fix a bug in ReactLynx Testing Library that rendered snapshot of inline style was normalized incorrectly (eg. `flex:1` was normalized to `flex: 1 1 0%;` incorrectly). ([#1040](https://github.com/lynx-family/lynx-stack/pull/1040))

## 0.109.2

### Patch Changes

- Support for locating errors in the source code directly on the device when exceptions occur when using MTS. ([#1019](https://github.com/lynx-family/lynx-stack/pull/1019))

  This requires Lynx engine v3.4 or later.

- Fix the "main-thread.js exception: ReferenceError: `__webpack_require__` is not defined" error in HMR. ([#985](https://github.com/lynx-family/lynx-stack/pull/985))

  This error occurred when setting `output.iife: true`, which is the default value in `@lynx-js/rspeedy` v0.9.8.

## 0.109.1

### Patch Changes

- Support the 'main-thread' directive as an alias for 'main thread'. ([#970](https://github.com/lynx-family/lynx-stack/pull/970))

- Reduce calls to `__AddInlineStyle` by pass non-literal object directly to `__SetInlineStyles`. ([#941](https://github.com/lynx-family/lynx-stack/pull/941))

## 0.109.0

### Minor Changes

- Support MTS functions running on the first screen. ([#840](https://github.com/lynx-family/lynx-stack/pull/840))

### Patch Changes

- Fix type error when using `Suspense` with `"jsx": "react-jsx"`. ([#854](https://github.com/lynx-family/lynx-stack/pull/854))

- Support lazy bundle in ReactLynx testing library. ([#869](https://github.com/lynx-family/lynx-stack/pull/869))

- Fix a bug in HMR that snapshots are always updated because the same unique ID check is not performed correctly. ([#869](https://github.com/lynx-family/lynx-stack/pull/869))

- Fix missing types of `key` on components when using `"jsx": "react-jsx"`. ([#872](https://github.com/lynx-family/lynx-stack/pull/872))

## 0.108.1

### Patch Changes

- Bump swc_core v23.2.0. ([#827](https://github.com/lynx-family/lynx-stack/pull/827))

## 0.108.0

### Minor Changes

- Reverts #239: "batch multiple patches for main thread communication" ([#649](https://github.com/lynx-family/lynx-stack/pull/649))

  This reverts the change that batched updates sent to the main thread in a single render pass.

### Patch Changes

- Add support for batch rendering in `<list>` with async resolution of sub-tree properties and element trees. ([#624](https://github.com/lynx-family/lynx-stack/pull/624))

  Use the `experimental-batch-render-strategy` attribute of `<list>`:

  ```tsx
  <list
    /**
     * Batch render strategy:
     * 0: (Default) Disabled - No batch rendering
     * 1: Basic - Only batch rendering enabled
     * 2: Property Resolution - Batch render with async property resolution for list item subtree
     * 3: Full Resolution - Batch render with async property and element tree resolution for list item subtree
     */
    experimental-batch-render-strategy={3}
  >
  </list>;
  ```

- rename @lynx-js/test-environment to @lynx-js/testing-environment ([#704](https://github.com/lynx-family/lynx-stack/pull/704))

- Auto import `@lynx-js/react/experimental/lazy/import` when using `import(url)` ([#667](https://github.com/lynx-family/lynx-stack/pull/667))

- Auto import `@lynx-js/react/experimental/lazy/import` when using `<component is={url} />` ([#666](https://github.com/lynx-family/lynx-stack/pull/666))

- Fixed a race condition when updating states and GlobalProps simultaneously. ([#707](https://github.com/lynx-family/lynx-stack/pull/707))

  This fix prevents the "Attempt to render more than one `<page />`" error from occurring during normal application usage.

- Fix error like `Unterminated string constant` when using multi-line JSX StringLiteral. ([#654](https://github.com/lynx-family/lynx-stack/pull/654))

## 0.107.1

### Patch Changes

- Fix error `OnPipelineStart arg count must == 1` on app load. ([#669](https://github.com/lynx-family/lynx-stack/pull/669))

## 0.107.0

### Minor Changes

- Some of the timing keys are renamed to match the naming convention of the Lynx Engine. ([#438](https://github.com/lynx-family/lynx-stack/pull/438))

  - `update_set_state_trigger` -> `updateSetStateTrigger`
  - `update_diff_vdom_start` -> `updateDiffVdomStart`
  - `update_diff_vdom_end` -> `updateDiffVdomEnd`
  - `diff_vdom_start` -> `diffVdomStart`
  - `diff_vdom_end` -> `diffVdomEnd`
  - `pack_changes_start` -> `packChangesStart`
  - `pack_changes_end` -> `packChangesEnd`
  - `parse_changes_start` -> `parseChangesStart`
  - `parse_changes_end` -> `parseChangesEnd`
  - `patch_changes_start` -> `patchChangesStart`
  - `patch_changes_end` -> `patchChangesEnd`
  - `hydrate_parse_snapshot_start` -> `hydrateParseSnapshotStart`
  - `hydrate_parse_snapshot_end` -> `hydrateParseSnapshotEnd`
  - `mts_render_start` -> `mtsRenderStart`
  - `mts_render_end` -> `mtsRenderEnd`

### Patch Changes

- Add testing library for ReactLynx ([#74](https://github.com/lynx-family/lynx-stack/pull/74))

- Refactor: Improved naming for list operation related types. Renamed `UpdateAction` interface to `ListOperations`. ([#592](https://github.com/lynx-family/lynx-stack/pull/592))

- Support using `"jsx": "react-jsx"` along with `"jsxImportSource": "@lynx-js/react"` in `tsconfig.json`. ([#545](https://github.com/lynx-family/lynx-stack/pull/545))

  ```json
  {
    "compilerOptions": {
      "jsx": "react-jsx",
      "jsxImportSource": "@lynx-js/react"
    }
  }
  ```

  This configuration enhances TypeScript definitions for standard JSX elements,
  providing type errors for unsupported elements like `<div>` or `<button>`.

- fix: JSX elements with dynamic `key={expr}` now wrapped in `wrapper` element to prevent merging. ([#547](https://github.com/lynx-family/lynx-stack/pull/547))

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
