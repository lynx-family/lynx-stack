---
"@lynx-js/testing-environment": patch
---

chore: declare `vitest` as an optional peer dependency

`@lynx-js/testing-environment` ships a vitest environment export that requires
`vitest` to be provided by the consumer. Declare it as an optional `peerDependency`
so third-party users testing with vitest get the correct resolution, while users on
the rstest path are unaffected.
