# @lynx-js/react-umd

## 0.123.1

### Patch Changes

- Ship the refresh runtime in the shared external bundle so it is loaded once instead of per card. ([#3009](https://github.com/lynx-family/lynx-stack/pull/3009))

  `@lynx-js/react/refresh` was missing from both the `react-umd` entry and the `reactlynx` externals preset, so every card bundled its own copy. Each copy overwrites `options.debounceRendering` on the _shared_ ReactLynx runtime with a closure that defers through that card's own `Promise`. The last card loaded wins, and once it is destroyed its microtask queue stops draining — the lost flush leaves Preact's scheduling counter set, so no card in the shared context ever re-renders again.

  Only the development bundle carries it; the production bundle is unchanged in size.

## 0.123.0

### Patch Changes

- Build web-encoded `react-{dev,prod}.web.bundle` variants (via `EXTERNAL_BUNDLE_TARGET=web`), decodable by `@lynx-js/web-core` and exposed as the `./dev-web` and `./prod-web` exports, alongside the native `.lynx.bundle`. ([#2934](https://github.com/lynx-family/lynx-stack/pull/2934))

## 0.122.1

## 0.122.0

## 0.121.2

## 0.121.1

## 0.121.0

## 0.120.0

### Patch Changes

- Support compile main-thread script to bytecode in external bundle ([#2459](https://github.com/lynx-family/lynx-stack/pull/2459))

## 0.119.0

## 0.118.0

## 0.117.1

### Patch Changes

- Add a new `entry` export to `@lynx-js/react-umd` for reuse by wrapper libraries of `@lynx-js/react`. ([#2370](https://github.com/lynx-family/lynx-stack/pull/2370))

## 0.117.0

### Minor Changes

- Add standalone UMD build of the ReactLynx runtime. ([#2331](https://github.com/lynx-family/lynx-stack/pull/2331))
