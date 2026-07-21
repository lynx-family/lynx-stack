# UI Judge

`ui_judge` is a Rust crate that renders a Lynx URL with the existing
`lynx-headless-rust-test-runner`, performs optional natural-language steps,
captures the software-renderer frame, and asks Agent SDK for a structured
visual-correctness score. When a reference image is included, the crate also
normalizes, aligns, and compares it with the same captured frame through a
separate deterministic evaluation chain. The default build provides the Rust
library. The `server` feature adds an HTTP server binary.

UI Judge has no Kitten-Lynx, Android, ADB, Playwright, Midscene, or npm runtime.
It does not modify or duplicate the headless runner.

## Rust API

Without the `server` feature, the crate root exposes only `judge_page`,
`JudgePageRequest`, and the corresponding `UiJudgeResult` / `UiJudgeError`
output types. Callers only need the request API to invoke it:

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

`timeout` applies independently to connection, navigation, each natural
language step, final screenshot capture, VLM scoring, and optional reference
image comparison. It is not an overall deadline for the entire request; this
preserves the behavior of the former TypeScript implementation.

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
discard successful comparison diagnostics. The default public crate surface
remains `judge_page`, `JudgePageRequest`, `UiJudgeResult`, and `UiJudgeError`;
comparison types and algorithms stay internal.

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

## HTTP server

Turn on the `server` feature to serve UI Judge over HTTP:

```bash
PORT=8080 cargo run -p ui_judge --features server --bin ui-judge-server
```

`PORT` defaults to `8080` and must be between `1` and `65535`. The process
listens on both `0.0.0.0:{PORT}` and `[::]:{PORT}`. Use `GET /health` for a
readiness check and `POST /judge` to evaluate a page.

The following request evaluates a local bundle. `url` and `task` are required.
The other fields are optional.

```bash
curl --request POST http://127.0.0.1:8080/judge \
  --header 'content-type: application/json' \
  --data '{
    "url": "file:///absolute/path/to/dist/main.lynx.bundle",
    "task": "The saved state should be clear and visually correct",
    "reference": null,
    "referenceImage": null,
    "steps": ["Tap the Save button"],
    "screenshotSettleMs": 16,
    "timeoutMs": 60000
  }'
```

The response is a JSON-encoded `UiJudgeResult`. A completed evaluation returns
HTTP `200`, including evaluation failures reported in the result's `error`
field. Invalid HTTP input returns `400`, `413`, or `422`. The server returns
`503` when its bounded capture queue is full or the headless worker is no longer
available. A headless-worker panic makes readiness return `503`, initiates
graceful shutdown, and is propagated as a server error after the worker is
joined. Request bodies are limited to 16 MiB.

The server accepts connections concurrently. It keeps native Lynx capture on a
dedicated current-thread runtime because the renderer is thread-bound. After a
capture completes, Tokio runs model scoring concurrently across requests and a
bounded Rayon pool performs CPU-heavy image normalization, alignment, and
comparison. The capture queue holds at most eight requests. Dropped queued
requests release their request data, dropped visual waiters signal cooperative
cancellation, and SIGINT or SIGTERM triggers graceful HTTP shutdown before the
headless worker is joined.

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
configured model. If no supported credential environment variable is set, the
integration test reports that it was skipped so fork pull requests can still
run the rest of the Rust suite.

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
