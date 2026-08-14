---
applyTo: ".github/workflows/workflow-website.yml,.github/workflows/deploy-main.yml,packages/genui/playground/**"
---

The hosted GenUI playground is deployed by building `packages/genui/playground` and copying its full `dist` directory into `website/doc_build/genui` in `.github/workflows/workflow-website.yml`. When adding another hosted route alias such as `/zh/genui`, copy the full `dist` directory to that route as well instead of adding only an HTML redirect, because the playground opens `render.html`, demo JSON, and bundle files relative to the current route.

Keep the reusable website build free of deployment environments because it also runs for pull-request and merge-group refs. For Pages deployments, load the environment-scoped `GENUI_SERVER_URL` in a `deploy-main.yml` pre-build configuration job and pass it to the reusable workflow as an input, then explicitly map that input into the GenUI playground build step. The deployment job is too late to change a server URL compiled into the static bundle.
