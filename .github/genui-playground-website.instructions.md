---
applyTo: ".github/workflows/workflow-website.yml,packages/genui/playground/**"
---

The hosted GenUI playground is deployed by building `packages/genui/playground` and copying its full `dist` directory into `website/doc_build/genui` in `.github/workflows/workflow-website.yml`. When adding another hosted route alias such as `/zh/genui`, copy the full `dist` directory to that route as well instead of adding only an HTML redirect, because the playground opens `render.html`, demo JSON, and bundle files relative to the current route.

Keep the reusable website build free of deployment environments because it also runs for pull-request and merge-group refs. Configure the public GenUI server origin as the repository-level `GENUI_SERVER_URL` Actions variable and explicitly map it into the GenUI playground build step; environment-level variables are unavailable unless the build itself targets that protected environment.
