---
applyTo: "website/sidebars/genui.ts"
---

Expose the website GenUI guide through package-owned Markdown: `packages/genui/docs` for the protocol chooser, `packages/genui/a2ui` for A2UI, `packages/genui/a2ui-catalog-extractor/README.md` and `readme.zh_cn.md` for the A2UI Catalog Extractor, and `packages/genui/openui` for OpenUI. Keep English and Simplified Chinese source pairs there, then synchronize them into `website/docs/{en,zh}/guide/genui` from `website/sidebars/genui.ts` so package and website documentation cannot drift. Keep the Catalog Extractor as an unlisted supporting page under the A2UI route: link to it from the Catalog Guide, but do not add it as a standalone navbar or sidebar entry. Rewrite package-relative cross-links to the corresponding website routes instead of GitHub URLs.
