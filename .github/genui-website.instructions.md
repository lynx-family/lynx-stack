---
applyTo: "website/sidebars/genui.ts,packages/genui/lynx-xml/**/*.md,packages/genui/openui/**/*.md,packages/genui/docs/*.md"
---

Expose the website GenUI guide through package-owned Markdown: `packages/genui/docs` for the protocol chooser, `packages/genui/a2ui` for A2UI, `packages/genui/a2ui-catalog-extractor/README.md` and `readme.zh_cn.md` for the A2UI Catalog Extractor, `packages/genui/openui` for OpenUI, and `packages/genui/lynx-xml` for Lynx XML. Give each integration an introduction, architecture overview, capability guide, and system-prompt guide; Lynx XML uses an artifact/validation guide rather than a component catalog. Keep English and Simplified Chinese source pairs there, then synchronize them into `website/docs/{en,zh}/guide/genui` from `website/sidebars/genui.ts` so package and website documentation cannot drift. Keep the Catalog Extractor as an unlisted supporting page under the A2UI route: link to it from the Catalog Guide, but do not add it as a standalone navbar or sidebar entry. Rewrite package-relative cross-links to the corresponding website routes instead of GitHub URLs.

Describe generated Lynx XML source as an artifact (产物). Explain `normalizeLynxXmlArtifact` as extraction, normalization, and structural validation (提取、规范化并校验产物); keep its public API name unchanged. Reserve documentation (文档) for the guide itself.

Use transformation (转换 / transform) for Template, ScriptReuse, and StylePreset in Lynx XML guides. Use `assembleLynxXmlArtifact` as the unified transformation entry point in examples and retain existing API names.

Keep the hosted-renderer playground quick start in `packages/genui/docs/playground.md` and `playground_zh.md`, synchronized by `website/sidebars/genui.ts`. Verify Web query parameters against `playground/src/render/query.ts` and native payload fields against `playground/lynx-src/a2ui/App.tsx`. Distinguish the Web `a2ui.web.js` bundle from the native `a2ui.lynx.js` bundle, and explain that native hosts must pass query payloads into global props; a bundle URL alone does not provide page data.

In the GenUI sidebar, expose only the quick-start guide as Playground Experience / Playground 体验; omit the separate direct Playground link. Keep the guide's page title as Build a playground / 快速搭建 Playground.

Link the Playground quick start to `https://lynx-stack.dev/genui/lynx-genui-stream.html`. Maintain the standalone HTML in `packages/genui/playground/public/`; Playground's publicDir includes it unchanged in dist and the existing website deployment workflow publishes that whole dist under /genui/. Keep website/rspress.config.ts unaware of Playground assets; do not add per-page copies or duplicate its static resources in the documentation build. Treat www/ as generated Rspeedy output rather than a source maintenance directory.

The standalone preview defaults to the Hokkaido OpenUI Chat example and queues its source until the renderer is ready. Keep its source editor, phone/wide preview, protocol selection, basic/Hokkaido example selector with an adjacent Reset example action, inline Markdown mode, independent drafts, immediate or simulated streaming rendering, stop and reset, without component catalogs, system prompts or agent/transport configuration. Resolve render.html relative to the served page so both the Playground root and deployed /genui/ path work. Keep the page and renderer on the same origin; file:// access and custom rendererUrl overrides are outside its current scope. Validate renderer readiness against its window, origin and current navigation token before delivering source.

Before validation builds, back up pre-existing edits to generated files such as `docs/i18n/zh.json`. A Turbo cache hit can overwrite those edits when restoring build outputs, even when the current change does not modify API documentation.

When adding a package-owned guide, register both language sources in the website synchronization and rewrite links from both README (`./docs/page.md`) and sibling guides (`./page.md`). Chinese source filenames ending in `_zh.md` must map to the normalized page route under `/zh/`. Add navigation entries for public guides and validate with `pnpm turbo build:docs --filter website` from the repository root; the separate API documentation build does not check these website links.

Use `text` fences for OpenUI DSL examples in synchronized guides. The website highlighter does not register an `openui` language, so that fence label fails the documentation build.
