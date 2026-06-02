---
applyTo: "packages/genui/a2ui*/**"
---

When maintaining A2UI component catalogs, keep the catalog-facing contract in a TypeScript interface marked with `@a2uiCatalog <ComponentName>`. The extractor consumes TypeDoc reflection data and does not parse TS/TSX source itself, so inline the JSON-schema-facing property shape instead of relying on aliases or external interfaces.

When working on multi-theme A2UI styling, keep shared token definitions in `packages/genui/a2ui/styles/theme.css` `:root`, and put theme-specific differences in the `.a2ui-light` and `.a2ui-dark` blocks. Prefer light/dark overrides for colors such as surface, text, border, overlay, and icon colors. Avoid reintroducing layout tokens like spacing, size, or radius as global CSS variables unless the component contract truly needs them; those should generally be handled by component CSS overrides instead. Keep `--a2ui-icon-font-family` configurable when icon glyph fonts need to vary by theme or embedding host.

Only `@a2uiCatalog` is a custom tag. Use standard TypeDoc-supported comments and tags for metadata: summaries for descriptions, `@remarks` for additional description, `@defaultValue` for schema defaults, and `@deprecated` for deprecated fields. Do not write JSON Schema in comments. Preserve existing enum order when regenerating catalog JSON, because catalog snapshots and LLM prompts can depend on deterministic option ordering.

Avoid adding `@defaultValue` for string defaults in A2UI catalog component props until the extractor normalizes TypeDoc code-span output; otherwise generated `catalog.json` may contain a rendered code fragment instead of the intended plain string. Prefer documenting the default in surrounding docs and keeping the runtime default in code.

Keep built-in catalog CSS assets in `packages/genui/a2ui/styles/catalog/*.css`, not under `src/catalog`. Catalog component TSX files should import those assets through paths that stay valid after TypeScript emits `dist/catalog/<Component>/index.jsx`, for example `../../../styles/catalog/Button.css`.

When styling A2UI catalog `DialogView` overlays that should be page-centered, give the overlay view page-filling bounds such as `width: 100%`, `height: 100%`, and explicit `top` / `right` / `bottom` / `left` offsets before relying on flex centering. Avoid `inset`, because the Lynx template encoder drops it.

For compact picker dialogs in A2UI phone previews, keep the natural content height below the small preview viewport; `max-height` is useful as a fallback, but dense controls such as calendar rows and time steppers may need smaller row heights so the dialog visually leaves top and bottom breathing room.

When implementing leaf input components in `packages/genui/a2ui/src/catalog`, import `Input`/`TextArea` from `@lynx-js/lynx-ui-input` directly and let the host decide whether to wrap the surface in keyboard-aware layout. Do not wrap individual catalog leaf components in `KeyboardAwareTrigger` unless the component owns the surrounding keyboard-aware responder/root contract.

For the `<A2UI>` shell, treat `className` and `wrapSurface` as complementary theming hooks. `className` belongs on the `surface-${surfaceId}` view itself, while `wrapSurface` is the outer wrapper for layout or theme shells. Prefer `className` when the theme lives on the surface root, and `wrapSurface` when you need an additional enclosing element.

When adding a built-in A2UI catalog component, update the component export chain (`src/catalog/index.ts`, `src/index.ts`, and the package `exports` map), refresh the all-builtins README recipe, and add the component plus its generated manifest to the playground `ALL_BUILTINS` list so official gallery examples can render it.

When adding a built-in A2UI catalog component that should be available to the GenUI server agent, make sure `packages/genui/a2ui-catalog-extractor` emits it into the generated full catalog at `dist/catalog/catalog.json`. The server should load the latest catalog from `BASIC_CATALOG_ID` at runtime and fall back to the committed full catalog at `packages/genui/server/agent/catalog/catalog.json` if the CDN request fails. Do not reintroduce per-component server catalog copies or a static server-side manifest import list.

When evolving `packages/genui/a2ui-playground`, treat protocol-prefixed hashes such as `#/a2ui/...` and `#/openui/...` as the canonical routes, and preserve the current mainline tab names (`create`, `examples`, `components`) when adding protocol-aware routing. If you keep compatibility aliases for older or transitional paths such as `#/demos` or `#/chat`, parse them into the canonical route model instead of letting a rebase silently rename the mainline routes.

For catalog navigation, keep `components` and `catalog` as route aliases that resolve to the same catalog page for a given protocol. Prefer one canonical tab label per protocol in the UI, but ensure legacy and new entrypoints both land on the same content so links and bookmarks stay valid during route renames.

When a GenUI package builds a CLI or other generated artifact that another workspace package executes during its own build, declare that package's `dist/**` (or equivalent generated directory) as Turbo `build.outputs`. Without explicit outputs, cache hits can skip restoring the built CLI and leave downstream workspace bins pointing at missing files.

When `packages/genui/a2ui` generates its catalog, ensure `packages/genui/a2ui-catalog-extractor` has been built first. The `genui a2ui generate catalog` command delegates through `@lynx-js/genui-cli`, which imports `../a2ui-catalog-extractor/dist/cli.js`; clean CI runs will fail if that dist CLI is not produced before A2UI's build or API extractor script.

When implementing A2UI v0.9 functions in `packages/genui/a2ui`, keep function resolution scoped to the active catalog first, with the global `FunctionRegistry` only as an escape hatch. Dynamic component props, checks, and function-call actions should all go through the same `resolveDynamicValue` / `executeFunctionCall` path so data bindings, nested function calls, zod argument coercion from `@a2ui/web_core`, and `formatString` data-context interpolation stay consistent.

When verifying `packages/genui/a2ui-playground`, remember that `pnpm -F @lynx-js/genui-a2ui build` first runs `tsc --project tsconfig.build.json` and then regenerates catalog JSON through `build:catalog`. The playground consumes `@lynx-js/genui/a2ui` through package exports under `dist/**`, so you normally do not need a separate `tsc` step unless you intentionally skipped the package `build` step.
When streaming A2UI server responses, emit a root `Loading` component immediately after `createSurface` so the new surface has visible content before the model streams real components. Do not send `Image` components with unresolved search-query `url` strings directly to the renderer. Emit a same-id `Loading` component while `packages/genui/server/agent/image-resolver.ts` resolves the query to a loadable image URL, then emit an `updateComponents` message with the resolved `Image` so parent component references stay stable.

When verifying `packages/genui/a2ui-playground`, remember that `pnpm -F @lynx-js/a2ui-reactlynx build` regenerates catalog JSON only. The playground consumes `@lynx-js/a2ui-reactlynx` through package exports under `dist/**`, so run `pnpm -F @lynx-js/a2ui-reactlynx exec tsc -p tsconfig.build.json` before rebuilding the playground if runtime TypeScript changed.

For known A2UI playground examples, keep the web preview URL on `?demo=<id>` instead of swapping it to the payload-store `messagesUrl`. `render.html` intentionally fetches known demo JSON in the browser shell and passes resolved messages into Lynx, avoiding fetch differences in the Lynx worker runtime; use payload-store URLs for custom edited JSON.

When restoring A2UI playground Create previews after a page refresh, boot the render iframe separately from restored message delivery. Send restored messages through an idempotent replay event that `render.html` can queue until `<lynx-view>.sendGlobalEvent` and the Lynx `MessageStore` are both available; do not rely on a single eager `postMessage` during iframe startup.

For interactive A2UI playground component examples, bind mutable props through `{ path: ... }` and provide matching example data so the component preview emits an initial `updateDataModel` before `updateComponents`. Literal values render the initial state but cannot be changed by `setValue`, which only writes back to data-bound props.

For the built-in `DateTimeInput`, keep date-enabled default output as `YYYY-MM-DD` unless `outputFormat` is explicitly provided. Implement calendar behavior inside `packages/genui/a2ui` with local helpers that borrow the `lynx-ui-calendar` windowing/date patterns as needed, because `@lynx-js/lynx-ui-calendar` is not an available package dependency here.

When changing A2UI README content under `packages/genui/a2ui` or `packages/genui/a2ui-playground/examples`, keep the corresponding Chinese README in sync. Keep the `packages/genui/a2ui` entry READMEs focused on first-time developers, and move deeper package material into topic docs under `docs/` with matching Chinese versions. Keep the playground examples README self-contained unless a split is explicitly requested. The Chinese docs should preserve the same technical boundaries as the English docs: `@lynx-js/genui/a2ui` is the client renderer/store/catalog runtime, `genui a2ui` is build/setup tooling, and the Agent service plus transport adapter are owned by the embedding app.

When adding A2UI website README link rewrites in `website/sidebars/genui.ts`, put longer relative paths before shorter substrings such as `./src/catalog/README.md`, otherwise `../src/catalog/README.md` can become a broken `./guide/...` URL. Keep generated README links to the `/a2ui` playground as external `https://lynxjs.org/a2ui` Markdown links; the toolbar/nav item can point at `/a2ui`, but Rspress dead-link checking treats Markdown `/a2ui` links as docs pages.
