---
applyTo: "packages/web-platform/web-core/ts/client/{mainthread/TemplateManager.ts,decodeWorker/**},packages/web-platform/web-core/tests/template-manager.spec.ts"
---

Treat a bundle URL as identifying the first bundle loaded by `TemplateManager.fetchBundle`. When the same URL is requested again, including while its first load is still pending, reuse that load and ignore any later override config instead of comparing or applying it. Do not refetch, replace the cached bundle, free its stylesheet, or revoke its published Lepus/background Blob URLs. Continue disposing unpublished partial resources after a load error.
