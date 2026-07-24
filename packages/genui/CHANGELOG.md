# @lynx-js/genui

## 0.2.0

### Minor Changes

- Add an A2UI `McpApp` catalog component that embeds trusted MCP Apps Lynx bundles through `frame`. ([#3001](https://github.com/lynx-family/lynx-stack/pull/3001))

### Patch Changes

- Update `@a2ui/web_core` from `0.9.1` to `0.10.5` ([#3113](https://github.com/lynx-family/lynx-stack/pull/3113))

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
