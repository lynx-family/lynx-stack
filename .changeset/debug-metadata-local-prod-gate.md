---
"@lynx-js/debug-metadata-rsbuild-plugin": patch
---

Skip `debug-metadata.json` emission on local production builds — nothing reads it there, but collecting it walks every source map. Production builds now emit it only on an automated build, detected via `CI`, `CI_REPO_NAME` or `BUILD_VERSION`; `DEBUG=rspeedy` opts back in. Dev builds are unaffected.
