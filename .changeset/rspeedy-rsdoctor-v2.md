---
"@lynx-js/rspeedy": minor
---

Upgrade the built-in Rsdoctor to `@rsdoctor/core@2.0.0-beta.3`, which supports the same Node.js range as Rspeedy (`^20.19.0 || >=22.12.0`). `RSDOCTOR=true` automatically enables Rsdoctor 2.0, and manually registered plugins are preserved without duplicate injection.

`tools.rsdoctor` accepts legacy Rsdoctor 1.x fields and migrates them to the Rsdoctor 2.0 configuration. Native graph collection is always enabled in Rsdoctor 2.0. Custom plugin registrations should import `RsdoctorRspackPlugin` from `@rsdoctor/core`.
