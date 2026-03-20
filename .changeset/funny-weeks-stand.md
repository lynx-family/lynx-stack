---
'@lynx-js/react': minor
---

feat: export `GlobalPropsProvider`, `GlobalPropsConsumer`, `useGlobalProps` and `useGlobalPropsChanged` for `__globalProps`

- `GlobalPropsProvider`: A Provider component that accepts `children`. It is used to provide the `lynx.__globalProps` context.
- `GlobalPropsConsumer`: A Consumer component that accepts a function as a child. It is used to consume the `lynx.__globalProps` context.
- `useGlobalProps`: A hook that returns the `lynx.__globalProps` object. It triggers a re-render when `lynx.__globalProps` changes.
- `useGlobalPropsChanged`: A hook that accepts a callback function. The callback is invoked when `lynx.__globalProps` changes.

Note: When `globalPropsMode` is not set to `'event'` (default is `'reactive'`), these APIs will be ineffective (pass-through) and will log a warning in development mode, as updates are triggered automatically by full re-render.
