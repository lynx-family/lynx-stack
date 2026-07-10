---
applyTo: "packages/genui/playground/**"
---

# GenUI Playground

## Runtime Boundaries

### Web and Native Host APIs

When sharing GenUI playground code between web preview and native Lynx execution paths, do not use bare `window` access in code that may run in Lynx. Read web-only capabilities through optional `globalThis` host adapters, and pass native preview data through `globalProps` or bridge fields rather than relying on browser globals.

When runtime code needs to distinguish Lynx for Web from native Lynx, prefer `SystemInfo.platform === 'web'` over `typeof window !== 'undefined'`. Native Lynx environments may expose browser-like globals, while Web Core explicitly sets `SystemInfo.platform` to `web`.

### Playback Synchronization

When wiring playback state between the Lynx app and the web preview, prefer `NativeModules.bridge.call('A2UI_PLAYBACK_SYNC', state, callback)` on the Lynx side and `lynxView.onNativeModulesCall` on the web preview side. Keep `window.postMessage` only as a compatibility fallback for older bundles. Do not add new playback sync paths that bypass the NativeModules bridge.

### Native Test Bundles

When serving the playground's native Lynx bundles as static Android test fixtures, keep HMR/React refresh out of `a2ui.lynx.js` and `openui.lynx.js`. The Android Lynx runtime does not provide globals such as `__prefresh_utils__` or Node's `process`, so normalize `process.env.NODE_ENV` at build time and disable HMR for these bundles instead of relying on the caller's `NODE_ENV`.

## Protocol-Aware Conversation Data

### Local History

When adding or updating playground conversation history, keep records isolated by protocol. Store new records with `ConversationMeta.protocol`, use protocol-scoped active-id metadata such as `activeConversationId:a2ui` and `activeConversationId:openui`, and treat legacy records without a `protocol` field as A2UI conversations so existing browser history remains visible.

### Shared Imports

When importing shared playground conversations, validate the `importConv` URL before fetching it. Accept only current-origin documents or the GenUI Supabase Storage conversation-object path, then validate the shared document protocol before calling `importShared`. Treat a missing shared-document protocol as legacy A2UI, and reject unknown or mismatched protocols.

## Component Catalog Architecture

### Shared Page and Protocol Sources

Keep page structure and editor/example selection state in `pages/catalog/ComponentCatalog.tsx`, with its styles co-located in `pages/catalog/ComponentCatalog.css`. Route both protocols through `pages/catalog/ComponentsPage.tsx`, and keep protocol-specific catalog data, validation, and render URL construction in `pages/catalog/a2ui.ts` and `pages/catalog/openui.ts`.

Keep the shared editor, copy feedback, example tabs, and `PreviewViewport` layout in `pages/catalog/ComponentUsagePreview.tsx`.

### Shared Presentation

Keep the A2UI and OpenUI component catalog pages visually identical by rendering both through `ComponentCatalog` and selecting a protocol-specific catalog source. Protocol-specific sources may vary their copy, routes, catalog data, validation, and preview payload construction, but must not duplicate the shared page JSX or add protocol-specific page-shell or component-card styling overrides.

### Catalog Preview Payloads

Send editable OpenUI usage DSL through `buildOpenUIRenderUrl` with `instant: true`, and forward the playground theme so the Lynx preview matches the surrounding catalog page.

Component catalog examples are intentionally inline-only. Keep every bundled usage snippet below `OPENUI_INLINE_RENDER_URL_MAX_LENGTH`, reject oversized edits with a visible error, and reserve `rawTextUrl` publishing for larger Examples/Create payloads rather than publishing on each catalog-editor keystroke.

## Example Showcase Architecture

Keep the shared example-list page structure, preview queue, keyboard interaction, section rendering, and card layout in `pages/demos/DemosList.tsx`. Route both protocols through `pages/demos/DemosListPage.tsx`, and keep protocol-specific scenarios, sections, preview URL construction, and queue reset keys in `pages/demos/a2ui.ts` and `pages/demos/openui.ts`.

Protocol-specific showcase sources may vary their header copy, section links, badges, layout mode, and preview payload construction, but must not duplicate the shared list-page JSX or card interaction logic.

Keep the shared example-detail workspace, editor/preview resizing, playback state machine, progress bridge, scenario sidebar, and mobile tabs in `pages/demos/DemosPage.tsx`, with its styles in `pages/demos/DemosPage.css`. Keep protocol-specific editor configuration, commit validation, playback chunking, payload publishing, and `PreviewPanelSource` construction in the existing `pages/demos/a2ui.ts` and `pages/demos/openui.ts` source modules.

## OpenUI Integration

### Lynx Entry Styling

When maintaining the OpenUI Lynx entry under `packages/genui/playground/lynx-src/openui`, import only the host-level style inputs that the entry owns: `@lynx-js/luna-styles/index.css` first, then `@lynx-js/genui/openui/styles/theme.css`. Do not import OpenUI catalog CSS, renderer CSS, `styles/material-icons.css`, `styles/index.css`, or `styles/renderer.css` from the playground entry.

OpenUI catalog styles are bundled by each catalog component's relative CSS import, the renderer style is bundled by `renderer.tsx` importing `./renderer.css`, and Material Icons font CSS is bundled by the Icon component. If the native preview looks unstyled, fix the source-side CSS import in `packages/genui/openui` instead of adding a package-level aggregate stylesheet to the playground entry.

OpenUI playground theming should apply matching classes such as `openui-light luna-light` or `openui-dark luna-dark` on the Lynx root view. Keep theme-specific feedback, loading, and scroll styling in the entry CSS instead of inline styles so Luna variables can control both the shell and renderer content.

### Large Preview Payloads

When building OpenUI playground preview links, avoid inlining large OpenUI Lang source in `rawText` query parameters. URL-encoded Chinese or generated DSL can exceed common request-line limits on deployed hosts; publish large source text and pass `rawTextUrl` to `render.html` instead.

## LazyComponent Integration

### Bundle Build

When adding a GenUI playground example that uses a ReactLynx standalone lazy bundle, build that lazy bundle with a separate Rspeedy config using `pluginReactLynx({ experimental_isLazyBundle: true })`.

Keep `output.cleanDistPath: false`, and run the lazy bundle build after the main `rspeedy build` so the main preview bundle does not clean the lazy bundle assets.

Keep both `web` and `lynx` environments enabled when the same lazy demo should run in browser and mobile previews. The lazy bundle output names should stay paired, for example `a2ui-lazy-component.web.bundle` for Lynx for Web and `a2ui-lazy-component.lynx.bundle` for native Lynx.

### URL and Payload Ownership

LazyComponent demo data should contain complete `url` and `webUrl` values before it reaches preview rendering. Build those URLs at data construction time from the runtime playground base URL, with query and hash removed and file paths such as `render.html` collapsed to their containing directory. Keep this resolution in the demo data layer, not in `PreviewPanel`.

Only demos backed by files copied to `dist/demos/*.json` should use `demoId` short links. Runtime-built demos such as `lazy-component` should remain known playground scenarios but pass inline `messages` into web preview and native QR preview links, because no `demos/lazy-component.json` file exists.

Keep `PreviewPanel` unaware of LazyComponent payload structure. It should choose between `demoId`, `messagesUrl`, and inline `messages/actionMocks`, then pass the selected payload through unchanged for web preview and QR/native preview paths.

For the A2UI `LazyComponent` catalog component, load ReactLynx standalone lazy bundle URLs with `import(url, { with: { type: 'component' } })`. In web rendering, use `webUrl` only when `SystemInfo.platform === 'web'`; if `webUrl` is absent, show the mobile-scan fallback instead of trying to load the native `url` in Lynx for Web.
