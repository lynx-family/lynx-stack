---
applyTo: ".github/workflows/workflow-website.yml,packages/genui/playground/**"
---

The hosted GenUI playground is deployed by building `packages/genui/playground` and copying its full `dist` directory into `website/doc_build/genui` in `.github/workflows/workflow-website.yml`. When adding another hosted route alias such as `/zh/genui`, copy the full `dist` directory to that route as well instead of adding only an HTML redirect, because the playground opens `render.html`, demo JSON, and bundle files relative to the current route.
