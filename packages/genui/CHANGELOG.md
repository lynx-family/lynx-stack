# @lynx-js/genui

## 0.3.0

### Minor Changes

- Added an `includeDefaultComponents` option to `createOpenUiLibrary`. Set it to ([#3445](https://github.com/lynx-family/lynx-stack/pull/3445))
  `false` to build a Library only from caller-provided definitions and component
  groups. The new `openui/explicit` entry and per-component catalog subpaths let
  applications keep unselected built-ins outside their static dependency graph.

### Patch Changes

- Render OpenUI Query defaults and prefetched results during the initial ([#3443](https://github.com/lynx-family/lynx-stack/pull/3443))
  ReactLynx render.
- Updated dependency `@a2ui/web_core` to `0.10.6`. ([#3416](https://github.com/lynx-family/lynx-stack/pull/3416))

- Updated dependency `@openuidev/lang-core` to `^0.2.11`. ([#3419](https://github.com/lynx-family/lynx-stack/pull/3419))

- Add `@lynx-js/react-signals`, a thread-aware Preact Signals adapter that keeps Signals dependencies out of `@lynx-js/react`. Signal reactivity runs on the background thread, while main-thread rendering uses static signal values with inactive setters, subscriptions, and effects. ([#3346](https://github.com/lynx-family/lynx-stack/pull/3346))
- Updated dependencies [[`c58b6f9`](https://github.com/lynx-family/lynx-stack/commit/c58b6f91cf7084d2585f42e00db3dd699c27ed61), [`328f712`](https://github.com/lynx-family/lynx-stack/commit/328f7125d1881cf438e58aa749f1e554a756b652)]:
  - @lynx-js/react-signals@0.0.1

## 0.2.1

### Patch Changes

- Adopt lynx-ui primitives and Luna theme tokens for OpenUI controls, and refresh the OpenUI playground experience. ([#3257](https://github.com/lynx-family/lynx-stack/pull/3257))

## 0.2.0

### Minor Changes

- Add an A2UI `McpApp` catalog component that embeds trusted MCP Apps Lynx bundles through `frame`. ([#3001](https://github.com/lynx-family/lynx-stack/pull/3001))

### Patch Changes

- Update `@preact/signals` from `^2.5.1` to `^2.9.4` ([#3116](https://github.com/lynx-family/lynx-stack/pull/3116))

- Update `typedoc` from `^0.28.19` to `^0.28.20` ([#3202](https://github.com/lynx-family/lynx-stack/pull/3202))

- Update `@a2ui/web_core` from `0.9.1` to `0.10.5` ([#3113](https://github.com/lynx-family/lynx-stack/pull/3113))

- Update `@openuidev/lang-core` from `^0.2.7` to `^0.2.9` ([#3197](https://github.com/lynx-family/lynx-stack/pull/3197))

## 0.1.0

### Minor Changes

- Add mcp apps protocol support ([#2982](https://github.com/lynx-family/lynx-stack/pull/2982))

### Patch Changes

- Move the Material Icons `@font-face` out of `a2ui/styles/theme.css` into a separate `a2ui/styles/material-icons.css`, imported only by the two stylesheets that render the font (`catalog/Icon.css`, `catalog/DateTimeInput.css`). ([#2914](https://github.com/lynx-family/lynx-stack/pull/2914))

  `theme.css` was 1,813,181 bytes, 99.9% of which was one base64 TTF data URI — and every `catalog/*.css` starts with `@import "../theme.css"`, so registering ANY catalog component shipped the 1.8 MB font even when no icon glyph was used (the CLI starter template pays this cost while registering no icon-bearing component). After this change `theme.css` is ~1.9 KB of theme tokens; apps that register `Icon` or `DateTimeInput` still get the font automatically via their catalog CSS, pixel-identical.

  The font stays an embedded TTF (Lynx native cannot parse woff2 — see #2711); it just no longer rides along with unrelated components. Custom-catalog authors who use `var(--a2ui-icon-font-family)` without registering a built-in icon component can opt back in with `import '@lynx-js/genui/a2ui/styles/material-icons.css'` (newly exported).

- Add `genui openui generate prompt` for writing the bundled OpenUI system prompt to stdout or a file. ([#2945](https://github.com/lynx-family/lynx-stack/pull/2945))

- Update OpenUI dependencies to align with the upstream OpenUI Lang core release and support Zod 4-compatible peer ranges. ([#2943](https://github.com/lynx-family/lynx-stack/pull/2943))

- Expand the OpenUI prompt catalog so generated prompts expose the ReactLynx renderer's layout, media, modal, tabs, picker, and date/time components. ([#2944](https://github.com/lynx-family/lynx-stack/pull/2944))

## 0.0.6

### Patch Changes

- Fix OpenUI streamed image rendering so partial state declaration values do not stick and image variants keep stable dimensions. ([#2905](https://github.com/lynx-family/lynx-stack/pull/2905))

## 0.0.5

### Patch Changes

- Expand the OpenUI catalog with more layout, media, modal, tabs, text, and picker components, and add richer playground examples that showcase the new component set. ([#2849](https://github.com/lynx-family/lynx-stack/pull/2849))

- Expose the `Children` API from ReactLynx and freeze the arrays returned by `Children.map`, `Children.forEach`, and `Children.toArray`. ([#2376](https://github.com/lynx-family/lynx-stack/pull/2376))

  Allow `@lynx-js/react` 0.121 and newer in GenUI peer dependency ranges.

## 0.0.4

### Patch Changes

- Add an OpenUI prompt subpath and server-backed create flow for generating OpenUI output in the GenUI playground. ([#2847](https://github.com/lynx-family/lynx-stack/pull/2847))
