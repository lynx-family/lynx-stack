---
"@lynx-js/react": minor
---

Bump `@lynx-js/internal-preact` from `10.28.4-dfff9aa` to `10.29.1-20260424024911-12b794f` ([diff](https://github.com/lynx-family/internal-preact/compare/10.28.4-dfff9aa...10.29.1-20260424024911-12b794f)).

Fixes wrong DOM order when a keyed child moves to a different `$N` slot across a re-render. Cross-slot moves now land at the correct slot position instead of being appended past stable siblings.
