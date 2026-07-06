# create-lynx-library

## 0.3.0

### Minor Changes

- Add shared native targets for native module and element library templates, with ([#2843](https://github.com/lynx-family/lynx-stack/pull/2843))
  Node-API package subpath loading for desktop hosts.

### Patch Changes

- Refine desktop element templates to share `LynxNativeView` state between Native ([#2909](https://github.com/lynx-family/lynx-stack/pull/2909))
  UI and Texture backends.

## 0.2.1

### Patch Changes

- Add Android and iOS platform selection to library scaffolding and make native autolink codegen honor the platforms declared in `lynx.lib.json`. ([#2864](https://github.com/lynx-family/lynx-stack/pull/2864))

## 0.2.0

### Minor Changes

- Rename the Native Autolink scaffold flow to libraries and switch codegen manifests to `lynx.lib.json`. ([#2729](https://github.com/lynx-family/lynx-stack/pull/2729))

### Patch Changes

- Update generated native library examples and package descriptions to use the current Lynx marker names. ([#2799](https://github.com/lynx-family/lynx-stack/pull/2799))

## 0.1.0

### Minor Changes

- Add the Native Autolink create-library package. ([#2587](https://github.com/lynx-family/lynx-stack/pull/2587))

### Patch Changes

- Use published package versions for scaffolded autolink codegen dependencies instead of workspace placeholders. ([#2628](https://github.com/lynx-family/lynx-stack/pull/2628))

- Fix npm bin symlink entrypoint detection for the create library CLI. ([#2623](https://github.com/lynx-family/lynx-stack/pull/2623))

## 0.0.0

### Minor Changes

- Initial Native Autolink library scaffolding package.
