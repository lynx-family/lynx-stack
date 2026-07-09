---
"@lynx-js/lynx-bundle-rslib-config": minor
---

`output.externalsPresets` entries accept the `{ async: true }` object form, so a produced external bundle awaits its ReactLynx externals (the `promise` external) before reading a subpath — required on web. External bundle builds also flag their react loaders as `isExternalBundle` so ReactLynx snapshots use the `__Card__` entry name.
