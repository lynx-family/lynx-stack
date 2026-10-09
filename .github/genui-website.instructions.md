---
applyTo: "website/sidebars/genui.ts,packages/genui/lynx-xml/**/*.md,packages/genui/docs/overview*.md"
---

Expose the website GenUI guide through package-owned Markdown: `packages/genui/docs` for the protocol chooser, `packages/genui/a2ui` for A2UI, `packages/genui/a2ui-catalog-extractor/README.md` and `readme.zh_cn.md` for the A2UI Catalog Extractor, `packages/genui/openui` for OpenUI, and `packages/genui/lynx-xml` for Lynx XML. Give each integration an introduction, architecture overview, capability guide, and system-prompt guide; Lynx XML uses an artifact/validation guide rather than a component catalog. Keep English and Simplified Chinese source pairs there, then synchronize them into `website/docs/{en,zh}/guide/genui` from `website/sidebars/genui.ts` so package and website documentation cannot drift. Keep the Catalog Extractor as an unlisted supporting page under the A2UI route: link to it from the Catalog Guide, but do not add it as a standalone navbar or sidebar entry. Rewrite package-relative cross-links to the corresponding website routes instead of GitHub URLs.

Describe generated Lynx XML source as an artifact (产物). Explain `normalizeLynxXmlArtifact` as extraction, normalization, and structural validation (提取、规范化并校验产物); keep its public API name unchanged. Reserve documentation (文档) for the guide itself.

Use transformation (转换 / transform) for Template, ScriptReuse, and StylePreset in Lynx XML guides. Use `assembleLynxXmlArtifact` as the unified transformation entry point in examples and retain existing API names.
