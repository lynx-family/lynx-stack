---
"@lynx-js/rspeedy": minor
---

Upgrade the built-in Rsdoctor to `@rsdoctor/core@2.0.0-beta.2`, which supports the same Node.js range as Rspeedy (`^20.19.0 || >=22.12.0`). `RSDOCTOR=true` automatically enables Rsdoctor 2.0, and manually registered plugins are preserved without duplicate injection.

Remove `tools.rsdoctor.experiments.enableNativePlugin`; native graph collection is always enabled in Rsdoctor 2.0. Custom plugin registrations should import `RsdoctorRspackPlugin` from `@rsdoctor/core`.
