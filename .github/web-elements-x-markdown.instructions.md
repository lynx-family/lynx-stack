---
applyTo: "packages/web-platform/web-elements/**/x-markdown/**,packages/web-platform/web-elements/**/XMarkdown/**,packages/web-platform/web-elements/tests/x-markdown*.spec.ts"
---

When testing x-markdown streaming, wait for a parsed Markdown node before appending content so lazy dependency loading cannot coalesce the entire stream into the initial render. Deliver successive content prefixes in separate timer tasks, and compare the final shadow DOM with an element that receives the same source once. Include inline syntax split across updates, fenced code blocks, and tables; complete paragraphs alone do not exercise Markdown parsing across chunk boundaries.

For typewriter streaming, verify that already visible text survives content appends while the stream is active. Waiting only for the final text after input stops misses animation progress being reset on each update.

Derive partial-word typewriter expectations by slicing complete strings so the repository spelling check does not mistake intentionally incomplete text for a typo.

Markdown appends can change earlier blocks, including through reference definitions. Parse the complete selected source and preserve unchanged leading DOM nodes instead of parsing appended lines independently. Typewriter appends should preserve the current step and restart a stopped timer when new text arrives, while replacements and clearing content reset progress.
