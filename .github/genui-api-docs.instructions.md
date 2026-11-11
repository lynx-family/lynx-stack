---
applyTo: "packages/genui/**/*.{ts,tsx,json,md}"
---

GenUI API reference pages are generated in `lynx-website` with TypeDoc from the `packages/genui` source overlay, not from API Extractor reports. Keep public exported classes, functions, and interfaces documented with TSDoc summary comments so the generated TypeDoc index tables have useful descriptions.

Do not reintroduce `api-extractor.json`, `api-extractor` package scripts, or committed `etc/*.api.md` reports under `packages/genui`. Other Lynx Stack packages may still use API Extractor, but GenUI should stay on the TypeDoc path.

The umbrella `packages/genui/README.md` is also rendered by TypeDoc into the API index. When linking from it to another package README, use an explicit repository URL with the section anchor; relative README links can become `_media/README.md` links and fail the docs dead-link check. Validate these links through the docs Turbo build.
