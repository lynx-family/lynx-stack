# UI Judge

`ui_judge` is a pure Rust library crate that renders a Lynx URL with the
existing `lynx-headless-rust-test-runner`, performs optional natural-language
steps, captures the software-renderer frame, and asks Agent SDK for a structured
visual-correctness score. When a reference image is supplied, the crate also
normalizes, aligns, and compares it with the same captured frame through a
separate deterministic evaluation chain.

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
    reference_image: None,
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

`reference` remains an optional textual target for the model. Set
`reference_image` to a plain base64 image, a `data:image/...;base64,...` URL, or
an HTTP(S) image URL to enable deterministic visual comparison. UI Judge uses
normalized cross-correlation to align the images, compares 32-pixel blocks,
and returns `alignment_score`, `visual_similarity`, `different_blocks`,
`total_blocks`, and `diff_image_base64` on `UiJudgeResult`.

The VLM and reference-image comparison are independent consumers of the final
screenshot. The VLM always receives only that screenshot plus `task` and the
optional textual `reference`; it never receives `reference_image`, alignment
output, pixel-diff output, or algorithmic similarity. Consequently the public
`score`, `reason`, and `summary` fields always come from the VLM. The `error`
field reports failures in the primary page-capture or VLM chain. A
reference-image failure is reported separately as `reference_image_error` and
does not replace a successful VLM result; a VLM failure likewise does not
discard successful comparison diagnostics. The public crate surface remains
`judge_page`, `JudgePageRequest`, `UiJudgeResult`, and `UiJudgeError`; comparison
types and algorithms stay internal.

The public VLM `score` remains an integer from 0 through 5. The independent
`visual_similarity` diagnostic is a block-level ratio from 0 through 1. Input
images are limited to 10 MiB compressed, 8192 pixels per dimension, and 8
megapixels after decoding.

The function internally creates the model client from the environment,
connects to headless Lynx, creates and navigates the page, executes steps,
captures the final PNG, and releases the page and Lynx connection before the
independent VLM and reference-image evaluations. Model, runner, page,
screenshot-comparison, prompt, and fixture-helper types are implementation
details and are not exported.

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
