---
"@lynx-js/react": patch
---

Fix the queries returned by `render` from `@lynx-js/react/testing-library` being typed as a union of every query's result when no `queries` option is passed, which made `fireEvent.tap(await findByText(...))` fail to type-check.
