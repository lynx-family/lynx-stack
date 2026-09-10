---
applyTo: "packages/rspeedy/core/**"
---

Use `@rsdoctor/core@2.0.0-beta.2` as a regular dependency and reuse its configuration types, retaining the simplified linter type and opaque SDK instance needed by Typia. The published beta.2 packages support `^20.19.0 || >=22.12.0`, matching Rspeedy; do not add Node version gates or Rsdoctor 1.x fallback paths. When `RSDOCTOR=true`, preserve manually registered plugins and only inject into unconfigured compiler configurations. Preserve `supports.banner: true` for Lynx runtime wrappers. Do not reintroduce `experiments.enableNativePlugin` for the built-in plugin.

Rspeedy tests may overwrite the package’s `dist` directory. Rebuild through Turbo after tests before packing the package for installation smoke tests.
