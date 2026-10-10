---
"@lynx-js/rsbuild-plugin": patch
"@lynx-js/qrcode-rsbuild-plugin": patch
---

Fix the dev server serving 404 for the URL (and QR code) it prints when `output.filename.bundle` contains hash placeholders.

`resolveBundleFilename` only fills `[name]` and `[platform]`: the hash is computed from the encoded template, which does not exist until `LynxTemplatePlugin` encodes it during the build. The printed URL therefore kept the placeholder verbatim (e.g. `/main.lynx.[contenthash:8].bundle`), a path no emitted asset was named after.

The URL and QR code are now printed with the hash placeholders stripped (e.g. `/main.lynx.bundle`): the hash changes on every recompile, so only a stable name keeps working across edits. The dev server rewrites such a request to the name of the actually emitted bundle, so the printed URL and the QR code keep pointing at the latest build. The URL with the placeholder verbatim keeps working too.
