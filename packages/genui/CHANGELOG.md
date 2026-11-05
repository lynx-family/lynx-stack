# @lynx-js/genui

## 0.7.2

### Patch Changes

- Updated dependencies [[`7d498ae`](https://github.com/lynx-family/lynx-stack/commit/7d498aece52a20e77abc19e2a4579333861c11da), [`7336d1e`](https://github.com/lynx-family/lynx-stack/commit/7336d1e5459ef3e46feafd597848e40a02d9a98d)]:
  - @lynx-js/react-rsbuild-plugin@0.22.1
  - @lynx-js/react-signals@0.0.7
  - @lynx-js/config-rsbuild-plugin@0.2.5
  - @lynx-js/rsbuild-plugin@0.1.7

## 0.7.1

### Patch Changes

- Updated dependencies [[`f3a9192`](https://github.com/lynx-family/lynx-stack/commit/f3a91921e53784b8255e5eda230ee8602648499e), [`f3a9192`](https://github.com/lynx-family/lynx-stack/commit/f3a91921e53784b8255e5eda230ee8602648499e)]:
  - @lynx-js/react-rsbuild-plugin@0.22.0
  - @lynx-js/react-signals@0.0.7
  - @lynx-js/config-rsbuild-plugin@0.2.5
  - @lynx-js/rsbuild-plugin@0.1.6

## 0.7.0

### Minor Changes

- Add the OpenUI Chat components Callout, CardHeader, Image, ImageBlock, InlineHeader, Separator, and TextArea with their upstream positional arguments, renderer and agent subpaths, and component styles. Support TextArea inside FormControl and Image inside CompositeCardItem, including reactive callout dismissal, multiline form validation, and image loading states. ([#4190](https://github.com/lynx-family/lynx-stack/pull/4190))

- Expose individual OpenUI Chat renderers at `openui/chat/<Component>` and server-safe definitions at `openui/chat/agent/<Component>`. Combine selected renderers with `openui/explicit` to include only their component and shared styles, while preserving the full Chat library factory. ([#4147](https://github.com/lynx-family/lynx-stack/pull/4147))

- Extend the OpenUI Chat library with image/text blocks, lists, steps, sections, column-based tables, and composite product cards using the upstream positional arguments. Add the document-specific ProductFeature extension and route display actions through the host callback. ([#4144](https://github.com/lynx-family/lynx-stack/pull/4144))

- Add OpenUI Chat Form, FormControl, Input, RadioGroup/RadioItem, CheckBoxGroup/CheckBoxItem and array-valued Slider controls. Store values through reactive bindings or named form state, preserve other groups when updating a shared checkbox binding, and validate controls before form actions. ([#4144](https://github.com/lynx-family/lynx-stack/pull/4144))

- Add an opt-in OpenUI Chat library with compatible Card, Text, BoldText, TextContent, Button, and Buttons arguments. Render Markdown and source citations on Lynx and expose a server-safe Chat schema entry without changing the default Stack catalog. ([#4143](https://github.com/lynx-family/lynx-stack/pull/4143))

- Export ReactLynx generation prompts, source validation, and Web/Native build utilities through the root and `/reactlynx` entry points. Include the compiler worker and runtime dependencies in the published package, and add bilingual ReactLynx guides. ([#4127](https://github.com/lynx-family/lynx-stack/pull/4127))

- Add the immutable `@Append(array, item)` OpenUI builtin, shared by the renderer and prompt library. Use it for Todo additions without a fixed list capacity and document data operations, nested-array semantics, and concurrency limits. ([#4173](https://github.com/lynx-family/lynx-stack/pull/4173))

- Add a built-in Web Canvas component to OpenUI with incremental drawing from streamed code chunks, reactive redraws, and click actions that expose logical canvas coordinates through state bindings. ([#4188](https://github.com/lynx-family/lynx-stack/pull/4188))

- Add the platform-independent `@lynx-js/genui/openui/data-tools` entry with ([#4168](https://github.com/lynx-family/lynx-stack/pull/4168))
  `getQueryDefaults`, `createQueryDataStore`, and `createQueryDataTools`. Reuse parsed Query defaults,
  inject scoped host storage, and restore saved values through
  `initialQueryResults`. Playground now delegates complete Query value replacements to this API
  while preserving its existing browser storage format. Share tool registration,
  default initialization, and scope lifecycle handling independently of host transport.

### Patch Changes

- Fix OpenUI Chat Markdown tables to stack header and data rows vertically, keep columns aligned, and scroll horizontally when the table exceeds the available width. ([#4143](https://github.com/lynx-family/lynx-stack/pull/4143))

- Keep the OpenUI Chat Markdown lexer on the background thread so native main-thread bundles compile successfully. Display text during the first frame before Markdown hydration. ([#4143](https://github.com/lynx-family/lynx-stack/pull/4143))

- Support per-group reasoning effort selection in Bench, defaulting to the selected model configuration, and report first text latency from streamed generation across protocols. ([#4134](https://github.com/lynx-family/lynx-stack/pull/4134))

- Fix GenUI type declarations to resolve React types through `@lynx-js/react`. ([#4135](https://github.com/lynx-family/lynx-stack/pull/4135))

- Recover missing closing braces after complete ReactLynx source files while preserving strict validation and size limits. Report unsupported imports with source locations and correction guidance, and clarify the exact permitted module name in generation prompts. ([#4132](https://github.com/lynx-family/lynx-stack/pull/4132))

- Add shared closed enum guidance to full and reduced OpenUI generation prompts and skill references. Require exact argument values and avoid borrowing values from other components or upstream libraries. ([#4133](https://github.com/lynx-family/lynx-stack/pull/4133))

- Align the renderer and headless OpenUI library factories around shared component ordering, groups, and option handling. Support componentNames in renderer libraries and includeDefaultComponents in prompt libraries, and omit unavailable built-in examples from system prompts with disabled defaults. ([#4193](https://github.com/lynx-family/lynx-stack/pull/4193))

- Guide generation to keep mutable ([#4168](https://github.com/lynx-family/lynx-stack/pull/4168))
  business content in Query results and update it through Mutation and Query
  refresh. Include the local data tool contract in the shared default OpenUI prompt
  only when the host declares both local data tools and tool calls are enabled. Execute preview mutations deterministically in local storage without
  model requests. Keep conversation history and shares as plain DSL with Query defaults. Restore
  saved local data only through the host renderer’s initialQueryResults input.
- Export a server-safe OpenUI catalog and share built-in component definitions between prompt generation and ReactLynx rendering. ([#4141](https://github.com/lynx-family/lynx-stack/pull/4141))

- Preserve OpenUI Chat field declarations when controls mount after an empty live response, before the renderer initializes its store. ([#4147](https://github.com/lynx-family/lynx-stack/pull/4147))
- Updated dependencies [[`bdb7471`](https://github.com/lynx-family/lynx-stack/commit/bdb7471ce6e98461b062d1572df766ecccf6bca4), [`89b828a`](https://github.com/lynx-family/lynx-stack/commit/89b828aba5e4eff14d8d2b5c44baecc121856c7d), [`1625472`](https://github.com/lynx-family/lynx-stack/commit/16254726bc1da310e828c7aac796de6edc8ffa3a), [`bdb7471`](https://github.com/lynx-family/lynx-stack/commit/bdb7471ce6e98461b062d1572df766ecccf6bca4), [`3d2b5e8`](https://github.com/lynx-family/lynx-stack/commit/3d2b5e8c3767c4f678e41cba5341386356b5e5dc)]:
  - @lynx-js/react-rsbuild-plugin@0.21.0
  - @lynx-js/react-signals@0.0.6
  - @lynx-js/config-rsbuild-plugin@0.2.5
  - @lynx-js/rsbuild-plugin@0.1.5

## 0.6.0

### Minor Changes

- Expose `normalizeLynxXmlArtifact` through `@lynx-js/genui/lynx-xml` for reusable document normalization and validation. ([#4122](https://github.com/lynx-family/lynx-stack/pull/4122))

### Patch Changes

- Improve streamed OpenUI previews and clarify generation prompts for positional arguments and valid media sources. ([#4125](https://github.com/lynx-family/lynx-stack/pull/4125))

- Keep dependency `@a2ui/web_core` to `0.10.6`. ([#4071](https://github.com/lynx-family/lynx-stack/pull/4071))
- Updated dependencies [[`18327c5`](https://github.com/lynx-family/lynx-stack/commit/18327c5af18578b1fb17f92418f8b3f8b5a2c983)]:
  - @lynx-js/react-signals@0.0.5

## 0.5.0

### Minor Changes

- Add optional StylePreset utility styles independently of Lynx XML Template ([#3987](https://github.com/lynx-family/lynx-stack/pull/3987))
  conversion, including `applyLynxXmlStylePreset` for direct Element PAPI documents.
  Generate only referenced Lynx-compatible CSS
  and preserve authored style overrides, with preset selection available in
  Playground Create and Bench.

### Patch Changes

- Simplify Lynx XML runtime and artifact constraints, keep design defaults in the shared server guidance, and allow asset and link URLs supplied by the host or enabled search/image tools. ([#3985](https://github.com/lynx-family/lynx-stack/pull/3985))

- Updated dependency `@openuidev/lang-core` to `^0.3.0`. ([#3829](https://github.com/lynx-family/lynx-stack/pull/3829))
- Updated dependencies [[`d8cef4e`](https://github.com/lynx-family/lynx-stack/commit/d8cef4eecf38696264c938aa4ca9e1b37e3ac775)]:
  - @lynx-js/react-signals@0.0.4

## 0.4.0

### Minor Changes

- Add a Lynx XML playground with real-time Vanilla Lynx artifact generation, ([#3634](https://github.com/lynx-family/lynx-stack/pull/3634))
  token-usage reporting, interactive examples, source editing, and direct
  zero-build previews through the shared protocol-aware render host. Expose a
  reusable Lynx XML system-prompt builder composed from the
  `@lynx-js/skill-vanilla-lynx` guidance, Lynx XML-specific overrides, and
  mobile-first responsive design constraints.
- Support `xxs` and `2xl` gap sizes in the OpenUI layout components. ([#3753](https://github.com/lynx-family/lynx-stack/pull/3753))

### Patch Changes

- Updated dependencies [[`80a92ae`](https://github.com/lynx-family/lynx-stack/commit/80a92ae51ca08b0ccfa3f3f9e88d029ecf9b186f)]:
  - @lynx-js/react-signals@0.0.3

## 0.3.1

### Patch Changes

- Make A2UI image prompt guidance provider-neutral so host agents can generate ([#3537](https://github.com/lynx-family/lynx-stack/pull/3537))
  image assets through their configured tools.
- Updated dependencies [[`d8f80cd`](https://github.com/lynx-family/lynx-stack/commit/d8f80cd019ecafddbacb7749e16a3eb293b28727)]:
  - @lynx-js/react-signals@0.0.2

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
