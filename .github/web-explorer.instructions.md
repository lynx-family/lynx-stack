---
applyTo: "packages/web-platform/web-explorer/**"
---

Use `@rsdoctor/core@2.0.0-rc.1` for Web Explorer bundle analysis. Import `RsdoctorRspackPlugin` from `@rsdoctor/core`; do not reintroduce the v1 `@rsdoctor/rspack-plugin` package. Rsdoctor 2 always supports the treemap, so do not configure the removed `supports.generateTileGraph` option.

Keep the Rsdoctor registration covered by the local Vitest project: import the Rsbuild configuration with `RSDOCTOR` both unset and set to `true`, mocking its build-time dependencies.
