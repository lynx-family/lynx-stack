---
applyTo:
  - "packages/lynx/autolink-codegen/**"
  - "packages/lynx/create-lynx-library/**"
---

# Lynx Library Instructions

Use the current Lynx library package names and marker names when creating or
updating Lynx libraries.

- The codegen package is `@lynx-js/autolink-codegen`.
- The codegen binary is `lynx-autolink-codegen`.
- Create new libraries with `create-lynx-library`.
- Android library APIs use only the Lynx marker names:
  `LynxElement`, `LynxNativeModule`, and `LynxService`.
- iOS library APIs should use `@LynxUIRegister`,
  `@LynxNativeModuleRegister`, and `@LynxServiceRegister`.
- The current create-library and codegen packages are Native-only. Do not add
  Web output in these packages.
- Keep `create-lynx-library` interactive prompts aligned with
  `create-rspeedy` by using `@clack/prompts` prompt primitives. Library feature
  selection should be a required multi-select that can produce Native Module,
  Element, and Service files in one package.
- Keep generated package dependency versions as workspace placeholders in
  templates, then replace them from `create-lynx-library` package metadata at
  scaffold time so published CLIs emit published versions.

iOS scanners in the native repo may still recognize existing Lynx lazy
registration forms for compatibility, but new generated templates should prefer
the marker names above.
