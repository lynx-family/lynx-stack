# @lynx-js/qrcode-rsbuild-plugin

## 0.6.0

### Minor Changes

- Read QR code entries from Rspeedy server routes. ([#2930](https://github.com/lynx-family/lynx-stack/pull/2930))

  BREAKING CHANGE: `@lynx-js/qrcode-rsbuild-plugin` now requires `@lynx-js/rspeedy@^0.16.0` because it relies on dev and preview server `routes` containing Lynx bundle entries. The plugin no longer reads the internal `rspeedy.env.entries` exposed API.

### Patch Changes

- Add `showQRCode` option to `registerConsoleShortcuts`. ([#2937](https://github.com/lynx-family/lynx-stack/pull/2937))

  When passed `showQRCode: false`, the shortcut runtime still prints URL(s) and keeps the interactive schema/entry switching, but skips rendering the ASCII QR code. This lets embedders that always launch via a deep link (or wrap the plugin with their own connection flow — e.g. `@byted-lynx/hdt-rsbuild-plugin`) suppress the QR block without forking the shortcut loop. Default remains `true`, so existing behavior is unchanged.

- Support Rspeedy v0.16.x. ([#2931](https://github.com/lynx-family/lynx-stack/pull/2931))

## 0.5.0

### Minor Changes

- Support [Rsbuild v2](https://rsbuild.rs/guide/upgrade/v1-to-v2#plugin-api) and rename `api.onAfterStartProdServer` hook to `api.onAfterStartPreviewServer` and `api.onDevCompileDone` hook to `api.onAfterDevCompile`. ([#2603](https://github.com/lynx-family/lynx-stack/pull/2603))

- Align Rspeedy, the QRCode plugin, and the Lynx bundle Rslib config Node.js engine metadata with Rsbuild v2 and Rslib requirements: Node.js 20.19+ or 22.12+. ([#2789](https://github.com/lynx-family/lynx-stack/pull/2789))

### Patch Changes

- feat(qrcode-rsbuild-plugin): add optional `fullscreen` URL hint + QR schema variant ([#2683](https://github.com/lynx-family/lynx-stack/pull/2683))

  Opt in via `fullscreen: true` (default `false`, preserving prior behavior). When enabled, the plugin:

  - Appends an `∟ Fullscreen` URL line under each Lynx bundle URL printed by the dev server (with `?fullscreen=true`).
  - Appends a `fullscreen` entry to the QR schema rotation — the QR still opens on the user's default schema; press `a` in the dev console to switch to `fullscreen`.

  Both open the bundle in LynxExplorer with the in-app navigation chrome stripped.

- Support the `output.filename.bundle` function form. ([#2701](https://github.com/lynx-family/lynx-stack/pull/2701))

## 0.4.7

### Patch Changes

- feat(qrcode): support get entry from api exposed from rspeedy.env.entries ([#2551](https://github.com/lynx-family/lynx-stack/pull/2551))

## 0.4.6

### Patch Changes

- Print all entries with all schema URLs in non-TTY environments instead of only showing the first entry's QR code. ([#2227](https://github.com/lynx-family/lynx-stack/pull/2227))

## 0.4.5

### Patch Changes

- Only register console shortcuts when running in TTY environments ([#2202](https://github.com/lynx-family/lynx-stack/pull/2202))

## 0.4.4

### Patch Changes

- Bump `@clack/prompts` v1.0 ([#2171](https://github.com/lynx-family/lynx-stack/pull/2171))

## 0.4.3

### Patch Changes

- fix: print out the output chunk urls ([#1921](https://github.com/lynx-family/lynx-stack/pull/1921))

## 0.4.2

### Patch Changes

- Bump @clack/prompts v1.0.0-alpha.5. ([#1809](https://github.com/lynx-family/lynx-stack/pull/1809))

## 0.4.1

### Patch Changes

- Bump @clack/prompts to v1.0.0-alpha.4 ([#1559](https://github.com/lynx-family/lynx-stack/pull/1559))

## 0.4.0

### Minor Changes

- Support "Type to search" when switching entries and schema. ([#1115](https://github.com/lynx-family/lynx-stack/pull/1115))

## 0.3.6

### Patch Changes

- Fix the issue where QR code fails to print after initial compilation errors are fixed. ([#610](https://github.com/lynx-family/lynx-stack/pull/610))

## 0.3.5

### Patch Changes

- Build with Rslib ([#396](https://github.com/lynx-family/lynx-stack/pull/396))

## 0.3.4

### Patch Changes

- Support NPM provenance. ([#30](https://github.com/lynx-family/lynx-stack/pull/30))

## 0.3.3

### Patch Changes

- f6c56fb: Add `README.md`.

## 0.3.2

### Patch Changes

- 2d15b44: fix: default value of output.filename changes to be `[name].[platform].bundle`.

## 0.3.1

### Patch Changes

- 1255d93: Add a dev shortcut `h` for help

## 0.3.0

### Minor Changes

- e2e23e2: **BREAKING CHANGE**: Change the default `output.filename` to `[name].lynx.bundle`.

## 0.2.9

### Patch Changes

- 23a858a: Bump @clack/prompts to ^0.9.1

## 0.2.8

### Patch Changes

- 8f91e6c: Initial Release.
