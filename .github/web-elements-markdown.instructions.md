---
applyTo: "packages/web-platform/web-elements/src/elements/XMarkdown/**,packages/web-platform/web-elements/tests/x-markdown.spec.ts"
---

Treat `x-markdown` content updates as cumulative Markdown source. Never parse an appended suffix independently: it may continue a heading, paragraph, list, table, or code fence, and later reference definitions can change earlier links. Preserve unchanged leading DOM nodes by comparing pristine sanitized parser output, before inline-view injection and visual effects modify the live DOM. Streaming regression tests should compare chunked rendering against a fresh one-shot render and verify that completed leading nodes retain identity.
