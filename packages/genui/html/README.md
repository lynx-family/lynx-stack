# @lynx-js/genui-html

Private, dependency-free prompt and document utilities for standalone HTML
generation. The package works in Node.js and browsers.

```ts
import {
  HTML_SYSTEM_PROMPT,
  extractHtmlArtifact,
  isCompleteHtmlArtifact,
  normalizeHtmlArtifact,
} from '@lynx-js/genui-html';
```

- `HTML_SYSTEM_PROMPT` defines the single-document HTML5 output contract,
  inline styles/scripts, and sandbox-compatible interactions.
- `extractHtmlArtifact(response)` removes prose and Markdown fences around a
  document. It also returns partial source once a doctype is available.
- `isCompleteHtmlArtifact(source)` checks the extracted source's preview
  envelope: leading doctype, HTML root, head/body opening tags, and closing HTML
  tag.
- `normalizeHtmlArtifact(response)` extracts and validates final output,
  additionally requiring head/body closing tags. Invalid output throws an error.

These utilities check document envelopes; they do not sanitize or execute HTML.
The Server owns model configuration, tools, design guidance, SSE, and Bench
orchestration. Playground owns `HtmlView`, its `allow-scripts` iframe sandbox,
and browser capture. HTML source is used directly and needs no compilation.

Server generation and Bench use `normalizeHtmlArtifact`; Playground uses
`extractHtmlArtifact` and `isCompleteHtmlArtifact` for streaming and history
restoration. Keep these consumers on the package exports.

Run validation from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm turbo build
pnpm exec rstest --project genui/html
```
