---
"@lynx-js/template-webpack-plugin": patch
---

Record a custom section's real location on the asset it was assembled from. An asset that moved into `customSections` kept the `lepusCode` or `manifest` location it was stamped with before the split, so consumers reading `lynx:tasm-section` were pointed at a section the bundle does not carry.
