---
applyTo: "packages/web-platform/web-elements/**/x-markdown/**,packages/web-platform/web-elements/**/XMarkdown/**,packages/web-platform/web-elements/tests/x-markdown*.spec.ts"
---

When testing x-markdown streaming, wait for a parsed Markdown node before appending content so lazy dependency loading cannot coalesce the entire stream into the initial render. Deliver successive content prefixes in separate timer tasks, and compare the final shadow DOM with an element that receives the same source once. Include inline syntax split across updates, fenced code blocks, and tables; complete paragraphs alone do not exercise Markdown parsing across chunk boundaries.

For typewriter streaming, verify that already visible text survives content appends while the stream is active. Waiting only for the final text after input stops misses animation progress being reset on each update.

Derive partial-word typewriter expectations by slicing complete strings so the repository spelling check does not mistake intentionally incomplete text for a typo.

Markdown appends can change earlier blocks, including through reference definitions. Parse the complete selected source and preserve unchanged leading DOM nodes instead of parsing appended lines independently. Typewriter appends should preserve the current step and restart a stopped timer when new text arrives, while replacements and clearing content reset progress.

Embedded `inlineview://` and `blockview://` images must have their sources converted to data attributes before HTML sanitization, then be replaced with named slots after sanitization in both normal and typewriter rendering. Inline views retain their styled span wrapper; block views insert the slot directly at the image position. Consumers must pre-set the matching slot attribute on their light DOM children.

Normalize embedded views in the sanitized append template before comparing it with existing DOM nodes, so unchanged paragraphs and slots retain their identity. Keep the typewriter cursor outside slots: children inside an assigned slot are fallback content and are not rendered. Test node identity across appends and cursor visibility at an embedded view boundary.
