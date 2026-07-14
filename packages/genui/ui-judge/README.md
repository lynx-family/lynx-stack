# UI Judge

`ui_judge` is a pure Rust library crate that renders a Lynx URL with the
existing `lynx-headless-rust-test-runner`, performs optional natural-language
steps, captures the software-renderer frame, and asks Agent SDK for a structured
visual-correctness score.

UI Judge has no Kitten-Lynx, Android, ADB, Playwright, Midscene, CLI, or npm
runtime. It does not modify or duplicate the headless runner.

## Rust API

The crate root exposes only `judge_page`, `JudgePageRequest`, and the
corresponding `UiJudgeResult` / `UiJudgeError` output types. Callers only need
the request API to invoke it:

```rust
use std::time::Duration;
use ui_judge::{judge_page, JudgePageRequest};

#[tokio::main(flavor = "current_thread")]
async fn main() {
  let result = judge_page(JudgePageRequest {
    reference: None,
    screenshot_settle: Duration::from_millis(16),
    steps: vec!["Tap the Save button".into()],
    task: "The saved state should be clear and visually correct".into(),
    timeout: Duration::from_secs(120),
    url: "file:///absolute/path/to/dist/main.lynx.bundle".into(),
  })
  .await;

  println!("score: {}/5", result.score);
}
```

`judge_page` accepts `file://`, `http://`, and `https://` URLs. Local bundles
must use an absolute `file:///...` URL; bare filesystem paths are rejected
before model or runtime initialization.

The function internally creates the model client from the environment,
connects to headless Lynx, creates and navigates the page, executes steps,
captures the final PNG, and releases the page and Lynx connection before final
scoring. Model, runner, page, screenshot-comparison, prompt, and fixture-helper
types are implementation details and are not exported.

Run `judge_page` sequentially on a Tokio current-thread runtime. The runner's
native task pump and page state remain bound to their creation thread. The
runner must have its standard runtime resources installed, including
`lynx_core.js` beside the executable on Linux or in `LynxResources.bundle` on
macOS.

Natural-language steps are planned with Agent SDK from the current DOM and
screenshot, then executed with selector-based tap and wait APIs. The runner has
no public swipe, scroll, typing, or coordinate-touch API, so those actions
produce an explicit unsupported error.

## Model configuration

The internal model client preserves the existing environment-variable
interface:

- `MIDSCENE_MODEL_API_KEY`
- `MIDSCENE_MODEL_BASE_URL`
- `MIDSCENE_MODEL_NAME`
- `MIDSCENE_MODEL_FAMILY`
- `MIDSCENE_MODEL_API` (`chat` or `responses`)
- `MIDSCENE_MODEL_TIMEOUT` or `MIDSCENE_MODEL_TIMEOUT_MS`
- `MIDSCENE_MODEL_INIT_CONFIG_JSON`
- `MIDSCENE_OPENAI_INIT_CONFIG_JSON` (legacy alias)
- `OPENAI_ORG_ID`
- `OPENAI_PROJECT_ID`

These names are retained for configuration compatibility; the implementation
does not load Midscene. OpenAI-compatible `OPENAI_*` aliases are also accepted.
The JSON init config preserves scalar `defaultHeaders` / `extraHeaders`,
`defaultQuery`, `organization`, and `project` entries. Both Chat Completions and
Responses wire formats feed Agent SDK structured-output validation. The legacy
`/crawl?ak=` endpoint is Chat-only.

Unit tests use `UI_JUDGE_MODEL_RESPONSE_JSON` or
`UI_JUDGE_MODEL_RESPONSES_JSON` for deterministic model output. The
`headless_e2e` integration test rejects both mock variables and calls the real
configured model.

## Tests

From the workspace root, install and build repository dependencies, generate
the React fixture, configure the model environment variables, then run the Rust
tests:

```bash
pnpm install --frozen-lockfile
pnpm turbo build
NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build \
  --root packages/genui/ui-judge/tests/fixtures/react
cargo test -p ui_judge --lib --tests --all-features
```

The generated `.generated/main.lynx.bundle` is ignored by Git. Runtime-backed
headless coverage runs on Linux and macOS.
