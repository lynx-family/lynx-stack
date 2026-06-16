---
applyTo: "packages/genui/a2ui-playground/**"
---

## Playback Bridge

When wiring playback state between the Lynx app and the web preview, prefer `NativeModules.bridge.call('A2UI_PLAYBACK_SYNC', state, callback)` on the Lynx side and `lynxView.onNativeModulesCall` on the web preview side. Keep `window.postMessage` only as a compatibility fallback for older bundles. Do not add new playback sync paths that bypass the NativeModules bridge.

## Native Bundles

When serving the playground's native Lynx bundles as static Android test fixtures, keep HMR/React refresh out of `a2ui.lynx.js` and `openui.lynx.js`. The Android Lynx runtime does not provide globals such as `__prefresh_utils__` or Node's `process`, so normalize `process.env.NODE_ENV` at build time and disable HMR for these bundles instead of relying on the caller's `NODE_ENV`.

When sharing A2UI playground code between web preview and native Lynx execution paths, do not use bare `window` access in code that may run in Lynx. Read web-only capabilities through optional `globalThis` host adapters, and pass native preview data through `globalProps` or bridge fields rather than relying on browser globals.

When runtime code needs to distinguish Lynx for Web from native Lynx, prefer `SystemInfo.platform === 'web'` over `typeof window !== 'undefined'`. Native Lynx environments may expose browser-like globals, while Web Core explicitly sets `SystemInfo.platform` to `web`.

## OpenUI Styling

When maintaining the OpenUI Lynx entry under `packages/genui/a2ui-playground/lynx-src/openui`, keep the renderer stylesheet imported by the entry CSS through `@lynx-js/genui/openui/styles/renderer.css`. The OpenUI catalog components emit plain `OpenUI*` class names, so the native preview will look unstyled if that renderer CSS is not bundled with `openui.lynx.js`.

## Lazy Bundles

When adding an A2UI playground example that uses a ReactLynx standalone lazy bundle, build that lazy bundle with a separate Rspeedy config using `pluginReactLynx({ experimental_isLazyBundle: true })`.

Keep `output.cleanDistPath: false`, and run the lazy bundle build after the main `rspeedy build` so the main preview bundle does not clean the lazy bundle assets.

Keep both `web` and `lynx` environments enabled when the same lazy demo should run in browser and mobile previews. The lazy bundle output names should stay paired, for example `a2ui-lazy-component.web.bundle` for Lynx for Web and `a2ui-lazy-component.lynx.bundle` for native Lynx.

LazyComponent demo data should contain complete `url` and `webUrl` values before it reaches preview rendering. Build those URLs at data construction time from the runtime playground base URL, with query and hash removed and file paths such as `render.html` collapsed to their containing directory. Keep this resolution in the demo data layer, not in `PreviewPanel`.

Only demos backed by files copied to `dist/demos/*.json` should use `demoId` short links. Runtime-built demos such as `lazy-component` should remain known playground scenarios but pass inline `messages` into web preview and native QR preview links, because no `demos/lazy-component.json` file exists.

Keep `PreviewPanel` unaware of LazyComponent payload structure. It should choose between `demoId`, `messagesUrl`, and inline `messages/actionMocks`, then pass the selected payload through unchanged for web preview and QR/native preview paths.

For the A2UI `LazyComponent` catalog component, load ReactLynx standalone lazy bundle URLs with `import(url, { with: { type: 'component' } })`. In web rendering, use `webUrl` only when `SystemInfo.platform === 'web'`; if `webUrl` is absent, show the mobile-scan fallback instead of trying to load the native `url` in Lynx for Web.
