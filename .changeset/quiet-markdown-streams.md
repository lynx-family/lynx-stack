---
"@lynx-js/web-elements": patch
---

Fix streamed `x-markdown` content losing Markdown context across chunks, including split headings, inline formatting, lists, tables, and code fences. Preserve unchanged leading DOM nodes when appending content.
