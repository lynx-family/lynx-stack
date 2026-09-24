---
"@lynx-js/rspeedy": patch
---

Upgrade the built-in Rsdoctor to `@rsdoctor/core@2.0.0-rc.1`, which supports the same Node.js range as Rspeedy (`^20.19.0 || >=22.12.0`). `RSDOCTOR=true` automatically enables Rsdoctor 2.0, and manually registered plugins are preserved without duplicate injection.

`tools.rsdoctor` accepts legacy Rsdoctor 1.x fields and migrates them to the Rsdoctor 2.0 configuration. Rsdoctor 2 enables native graph collection and treemap visualization by default. Custom plugin registrations should import `RsdoctorRspackPlugin` from `@rsdoctor/core`.
