---
applyTo: "packages/genui/ui-judge/**/*"
---

Keep `@lynx-js/ui-judge` screenshot-first. The public TypeScript API should compare caller-provided `referenceImage` and `renderedImage` values through `runVisualEvaluation`; do not add webpage navigation, Playwright page ownership, or screenshot capture back into the package API.

Keep `packages/genui/ui-judge/src/index.ts` as a public facade that only re-exports screenshot visual-evaluation APIs and public types. Do not reintroduce webpage `judgePage`, Midscene adapter classes, or the old TypeScript `src/core` scoring stack.

Keep screenshot visual-evaluation implementation in Rust. The TypeScript `src/visual-evaluation/service.ts` should stay a thin compatibility wrapper around the Rust `ui-judge visual-evaluation` CLI; do not reintroduce Sharp image processing, Mastra/AI SDK agent construction, custom TypeScript evaluate hooks, or `@midscene/*` dependencies.

Keep Rust Kitten-Lynx/Android automation, screenshot alignment/diffing, visual model evaluation, Android `judgeAndroidAgent` scoring, GEQI dimension prompts, 0-5 score normalization, structured report JSON generation, and UI Judge package tests under `packages/genui/ui-judge/rust` with crate metadata in `packages/genui/ui-judge/Cargo.toml`. Do not add Vitest tests for `@lynx-js/ui-judge`; screenshot/API coverage should be Rust unit or integration tests and must not require browsers, emulators, or real model credentials; use the Rust mock-response environment hook when needed.

The Rust `ui-judge` CLI consumes JSON scenario files, captures screenshots from Android Lynx pages, calls an OpenAI-compatible model client, and writes old-compatible result JSON. Keep PR comment Markdown rendering in `.github/actions/ui-judge-comment`. Keep the CI-facing model environment variable names compatible with the existing `MIDSCENE_MODEL_*` and `MIDSCENE_OPENAI_INIT_CONFIG_JSON` secrets even though the implementation must not add a Midscene runtime dependency back.

For Rust Android e2e fixtures, keep the React Lynx fixture source under `packages/genui/ui-judge/tests/fixtures/react` and build the `.lynx.bundle` into the ignored `.generated/` directory with `rspeedy build`. Do not commit generated `.lynx.bundle` binaries.
