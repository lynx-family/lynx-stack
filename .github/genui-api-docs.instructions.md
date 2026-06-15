---
applyTo: "packages/genui/**/*.{ts,tsx,json,md}"
---

GenUI API reference pages are generated in `lynx-website` with TypeDoc from the `packages/genui` source overlay, not from API Extractor reports. Keep public exported classes, functions, and interfaces documented with TSDoc summary comments so the generated TypeDoc index tables have useful descriptions.

Do not reintroduce `api-extractor.json`, `api-extractor` package scripts, or committed `etc/*.api.md` reports under `packages/genui`. Other Lynx Stack packages may still use API Extractor, but GenUI should stay on the TypeDoc path.
