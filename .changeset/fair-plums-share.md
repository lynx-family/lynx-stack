---
"@lynx-js/testing-environment": minor
---

**BREAKING CHANGE**:

Align the public test-environment API around `LynxEnv`.

`LynxTestingEnv` now expects a `{ window }`-shaped environment instead of relying on a concrete `JSDOM` instance or `global.jsdom`. Callers that construct `LynxTestingEnv` manually or initialize the environment through globals should migrate to `new LynxTestingEnv({ window })` or set `global.lynxEnv`.

This release also adds the `@lynx-js/testing-environment/env/rstest` entry for running the shared testing-environment suite under rstest.
