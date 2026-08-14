---
applyTo: ".github/workflows/workflow-website.yml,packages/genui/playground/**"
---

The hosted GenUI playground is deployed by building `packages/genui/playground` and copying its full `dist` directory into `website/doc_build/genui` in `.github/workflows/workflow-website.yml`. When adding another hosted route alias such as `/zh/genui`, copy the full `dist` directory to that route as well instead of adding only an HTML redirect, because the playground opens `render.html`, demo JSON, and bundle files relative to the current route.

Keep the website build job attached to the `github-pages` environment and explicitly map its `GENUI_SERVER_URL` configuration variable into the GenUI playground build step. Environment-level configuration variables are not automatically exported to the runner, and the deploy job is too late to change a server URL compiled into the static bundle.
