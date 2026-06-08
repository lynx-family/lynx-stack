---
applyTo: "packages/genui/openui/**"
---

When maintaining `packages/genui/openui`, treat OpenUI v0.5 rendering as driven by raw response text through `<OpenUiRenderer response={...}>`. Keep `<OpenUiRenderer result={...}>` only as the legacy pre-parsed/static compatibility path; v0.5 features such as `$` state declarations, `Query`, `Mutation`, and multi-step `Action` plans need the parser/evaluator runtime created by `useOpenUIState`.

When changing exported OpenUI runtime APIs, refresh both API reports with `pnpm turbo api-extractor --filter @lynx-js/genui-openui -- --local` and `pnpm turbo api-extractor --filter @lynx-js/genui -- --local`, because `@lynx-js/genui` re-exports the OpenUI surface.

When adding OpenUI v0.5 cases to `packages/genui/a2ui-playground`, keep raw protocol examples limited to components supported by `packages/genui/openui/src/catalog` unless the same change extends the catalog. Query and Mutation examples need matching mock tools in `packages/genui/a2ui-playground/lynx-src/openui/App.tsx` so `/render.html` previews exercise the runtime path instead of staying on default or unresolved values.
