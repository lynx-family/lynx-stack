---
applyTo: "packages/genui/a2ui*/**"
---

When maintaining A2UI component catalogs, keep the catalog-facing contract in a TypeScript interface marked with `@a2uiCatalog <ComponentName>`. The extractor consumes TypeDoc reflection data and does not parse TS/TSX source itself, so inline the JSON-schema-facing property shape instead of relying on aliases or external interfaces.

Only `@a2uiCatalog` is a custom tag. Use standard TypeDoc-supported comments and tags for metadata: summaries for descriptions, `@remarks` for additional description, `@defaultValue` for schema defaults, and `@deprecated` for deprecated fields. Do not write JSON Schema in comments. Preserve existing enum order when regenerating catalog JSON, because catalog snapshots and LLM prompts can depend on deterministic option ordering.

Avoid adding `@defaultValue` for string defaults in A2UI catalog component props until the extractor normalizes TypeDoc code-span output; otherwise generated `catalog.json` may contain a rendered code fragment instead of the intended plain string. Prefer documenting the default in surrounding docs and keeping the runtime default in code.

Keep built-in catalog CSS assets in `packages/genui/a2ui/styles/catalog/*.css`, not under `src/catalog`. Catalog component TSX files should import those assets through paths that stay valid after TypeScript emits `dist/catalog/<Component>/index.jsx`, for example `../../../styles/catalog/Button.css`.

When implementing leaf input components in `packages/genui/a2ui/src/catalog`, import `Input`/`TextArea` from `@lynx-js/lynx-ui-input` directly and let the host decide whether to wrap the surface in keyboard-aware layout. Do not wrap individual catalog leaf components in `KeyboardAwareTrigger` unless the component owns the surrounding keyboard-aware responder/root contract.

For the `<A2UI>` shell, treat `className` and `wrapSurface` as complementary theming hooks. `className` belongs on the `surface-${surfaceId}` view itself, while `wrapSurface` is the outer wrapper for layout or theme shells. Prefer `className` when the theme lives on the surface root, and `wrapSurface` when you need an additional enclosing element.

When adding a built-in A2UI catalog component, update the component export chain (`src/catalog/index.ts`, `src/index.ts`, and the package `exports` map), refresh the all-builtins README recipe, and add the component plus its generated manifest to the playground `ALL_BUILTINS` list so official gallery examples can render it.

When evolving `packages/genui/a2ui-playground`, treat protocol-prefixed hashes such as `#/a2ui/...` and `#/openui/...` as the canonical routes, and preserve the current mainline tab names (`create`, `examples`, `components`) when adding protocol-aware routing. If you keep compatibility aliases for older or transitional paths such as `#/demos` or `#/chat`, parse them into the canonical route model instead of letting a rebase silently rename the mainline routes.

When a GenUI package builds a CLI or other generated artifact that another workspace package executes during its own build, declare that package's `dist/**` (or equivalent generated directory) as Turbo `build.outputs`. Without explicit outputs, cache hits can skip restoring the built CLI and leave downstream workspace bins pointing at missing files.
