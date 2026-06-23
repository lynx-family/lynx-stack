---
applyTo: "packages/genui/ui-judge/**/*"
---

Keep `@lynx-js/ui-judge` screenshot-first. The public TypeScript API should compare caller-provided `referenceImage` and `renderedImage` values through `runVisualEvaluation`; do not add webpage navigation, Playwright page ownership, or screenshot capture back into the package API.

Keep `packages/genui/ui-judge/src/index.ts` as a public facade that only re-exports screenshot visual-evaluation APIs and public types. Do not reintroduce `judgePage`, `judgeAndroidAgent`, Midscene adapter classes, GEQI dimension prompts, or the old `src/core` scoring stack.

Use the agent SDK path for model evaluation. `evaluation-api.ts` should build Mastra/AI SDK-compatible image messages and call an injected or internally-created agent; do not depend on `@midscene/*`.

Keep Rust Kitten-Lynx/Android automation under `packages/genui/ui-judge/rust` and the Rust crate metadata under `packages/genui/ui-judge/Cargo.toml`. The TypeScript tests should remain ordinary Vitest screenshot/unit tests and must not require browsers, emulators, or model credentials.

For Rust Android e2e fixtures, keep the Lynx bundle fixture available under `packages/genui/ui-judge/tests/fixtures` unless the Rust test is updated to a new fixture path in the same change.
