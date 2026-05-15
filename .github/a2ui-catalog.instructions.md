---
applyTo: "packages/genui/a2ui*/**"
---

When maintaining A2UI component catalogs, keep the catalog-facing contract in a TypeScript interface marked with `@a2uiCatalog <ComponentName>`. The extractor consumes TypeDoc reflection data and does not parse TS/TSX source itself, so inline the JSON-schema-facing property shape instead of relying on aliases or external interfaces.

Only `@a2uiCatalog` is a custom tag. Use standard TypeDoc-supported comments and tags for metadata: summaries for descriptions, `@remarks` for additional description, `@defaultValue` for schema defaults, and `@deprecated` for deprecated fields. Do not write JSON Schema in comments. Preserve existing enum order when regenerating catalog JSON, because catalog snapshots and LLM prompts can depend on deterministic option ordering.

Keep built-in catalog CSS assets in `packages/genui/a2ui/styles/catalog/*.css`, not under `src/catalog`. Catalog component TSX files should import those assets through paths that stay valid after TypeScript emits `dist/catalog/<Component>/index.jsx`, for example `../../../styles/catalog/Button.css`.

For the `<A2UI>` shell, treat `className` and `wrapSurface` as complementary theming hooks. `className` belongs on the `surface-${surfaceId}` view itself, while `wrapSurface` is the outer wrapper for layout or theme shells. Prefer `className` when the theme lives on the surface root, and `wrapSurface` when you need an additional enclosing element.

When evolving `packages/genui/a2ui-playground`, treat protocol-prefixed hashes such as `#/a2ui/...` and `#/openui/...` as the canonical routes, and preserve the current mainline tab names (`create`, `examples`, `components`) when adding protocol-aware routing. If you keep compatibility aliases for older or transitional paths such as `#/demos` or `#/chat`, parse them into the canonical route model instead of letting a rebase silently rename the mainline routes.

When a GenUI package builds a CLI or other generated artifact that another workspace package executes during its own build, declare that package's `dist/**` (or equivalent generated directory) as Turbo `build.outputs`. Without explicit outputs, cache hits can skip restoring the built CLI and leave downstream workspace bins pointing at missing files.

When implementing A2UI v0.9 functions in `packages/genui/a2ui`, keep function resolution scoped to the active catalog first, with the global `FunctionRegistry` only as an escape hatch. Dynamic component props, checks, and function-call actions should all go through the same `resolveDynamicValue` / `executeFunctionCall` path so data bindings, nested function calls, zod argument coercion from `@a2ui/web_core`, and `formatString` data-context interpolation stay consistent.

When verifying `packages/genui/a2ui-playground`, remember that `pnpm -F @lynx-js/a2ui-reactlynx build` regenerates catalog JSON only. The playground consumes `@lynx-js/a2ui-reactlynx` through package exports under `dist/**`, so run `pnpm -F @lynx-js/a2ui-reactlynx exec tsc -p tsconfig.build.json` before rebuilding the playground if runtime TypeScript changed.

For known A2UI playground examples, keep the web preview URL on `?demo=<id>` instead of swapping it to the payload-store `messagesUrl`. `render.html` intentionally fetches known demo JSON in the browser shell and passes resolved messages into Lynx, avoiding fetch differences in the Lynx worker runtime; use payload-store URLs for custom edited JSON.
