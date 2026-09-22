---
applyTo: "packages/web-platform/web-explorer/**"
---

Use `@rsdoctor/core@2.0.0-rc.0` for Web Explorer bundle analysis. Import `RsdoctorRspackPlugin` from `@rsdoctor/core`; do not reintroduce the v1 `@rsdoctor/rspack-plugin` package. Rsdoctor 2 always supports the treemap, so do not configure the removed `supports.generateTileGraph` option.
