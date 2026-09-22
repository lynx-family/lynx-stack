---
"@lynx-js/rspeedy": patch
---

Upgrade the built-in Rsdoctor to `@rsdoctor/core@2.0.0-rc.0`, which supports the same Node.js range as Rspeedy (`^20.19.0 || >=22.12.0`). `RSDOCTOR=true` automatically enables Rsdoctor 2.0, and manually registered plugins are preserved without duplicate injection.

`tools.rsdoctor` accepts legacy Rsdoctor 1.x fields and migrates them to the Rsdoctor 2.0 configuration. Native graph collection is no longer enabled by Rspeedy’s default configuration; configure it explicitly when needed. Custom plugin registrations should import `RsdoctorRspackPlugin` from `@rsdoctor/core`.
