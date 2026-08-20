# UI Judge

`ui_judge` is a Rust crate that renders a Lynx URL with the existing
`lynx-headless-rust-test-runner`, performs optional natural-language steps,
captures the software-renderer frame, and asks Agent SDK for a structured
visual-correctness score. An optional independent pairwise dimension follows
the core [UI-Bench](https://arxiv.org/abs/2508.20410) match protocol: it
captures a second project generated for the same task, randomizes their blinded
model order, forces a client-delivery preference with no tie, and updates the
two prompt-specific TrueSkill ratings. When a reference image is included, a
separate deterministic evaluation chain normalizes, aligns, and compares it
with the primary captured frame. The default build provides the Rust library.
The `server` feature adds an HTTP server binary.

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
    include_geqi: true,
    reference: None,
    reference_image: None,
    screenshot_settle: Duration::from_millis(16),
    steps: vec!["Tap the Save button".into()],
    task: "The saved state should be clear and visually correct".into(),
    timeout: Duration::from_secs(120),
    ui_bench_candidate_mu: None,
    ui_bench_candidate_sigma: None,
    ui_bench_opponent_mu: None,
    ui_bench_opponent_sigma: None,
    ui_bench_opponent_url: None,
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
language step, final screenshot capture, visual-correctness scoring, every
enabled GEQI dimension, and optional reference-image comparison. An optional
opponent receives its own connection, navigation, steps, and screenshot
timeouts, and the pairwise vote receives a separate full timeout. It is not an
overall deadline for the entire request; this preserves the behavior of the
former TypeScript implementation.

Set `include_geqi` to score the final screenshot independently across four
weighted GEQI dimensions. The top-level `score`, `reason`, and `summary`
remain the separate visual-correctness result. `dimensions` contains the four
0-5 results and their relative weights, while `geqi_score` normalizes their
weighted result to a 0-100 score:

- Usability & Interaction Logic: weight 30
- Visual Communication & Aesthetics: weight 25
- Consistency & Standards: weight 15
- Information Architecture & UX Writing: weight 15

All five VLM evaluations consume the same final screenshot and run
independently. A failed GEQI dimension is returned with `score: 0` and its own
`error`; it does not replace the visual-correctness result. The weighted score
retains the historical calculation in which such an error result contributes
zero, so callers should inspect every dimension error before treating the
aggregate as a complete evaluation.

`reference` remains an optional textual target for the model. Set
`reference_image` to a plain base64 image, a `data:image/...;base64,...` URL, or
an HTTP(S) image URL to enable deterministic visual comparison. UI Judge uses
normalized cross-correlation to align the images, compares 32-pixel blocks,
and returns `alignment_score`, `visual_similarity`, `different_blocks`,
`total_blocks`, and `diff_image_base64` on `UiJudgeResult`.

The visual-correctness and GEQI VLM dimensions, optional UI-Bench pairwise
dimension, and reference-image comparison are independent chains. The
single-screenshot dimensions receive only the primary screenshot plus `task`
and textual `reference`. UI-Bench receives only anonymized primary and opponent
screenshots plus the same textual context. No VLM receives `reference_image`,
alignment output, pixel-diff output, algorithmic similarity, or candidate URLs.
The public `score`, `reason`, `summary`, and `error` fields retain their original
visual-correctness meaning; `dimensions` and `geqi_score` retain their GEQI
meaning. A UI-Bench or reference-image failure is reported separately and never
overwrites another successful dimension; independent results also survive a
primary VLM failure. The default public crate surface remains `judge_page`,
`JudgePageRequest`, `UiJudgeResult`, and `UiJudgeError`; model, rating, and
comparison implementation types stay internal.

The primary `score` remains an integer from 0 through 5. UI-Bench does not
produce an absolute score: it returns one pairwise winner and updated
continuous TrueSkill state. The independent `visual_similarity` diagnostic is
a block-level ratio from 0 through 1. Input images are limited to 10 MiB
compressed, 8192 pixels per dimension, and 8 megapixels after decoding.

## UI-Bench pairwise evaluation

Set `ui_bench_opponent_url` to a second Lynx project generated for the same
`task`. UI Judge executes the same normalized `steps` on both projects,
captures them sequentially on the thread-bound Lynx worker, removes their
identities from the model input, randomly assigns them to Project A and Project
B, and asks the paper's forced-choice client-delivery question. The structured
response permits only `project_a` or `project_b`; there is no absolute rating or
tie.

The first match for a prompt defaults both participants to the paper's
TrueSkill initialization, `mu = 25` and `sigma = 25 / 3`. For later matches,
feed the prior prompt-specific state back through:

- `ui_bench_candidate_mu`
- `ui_bench_candidate_sigma`
- `ui_bench_opponent_mu`
- `ui_bench_opponent_sigma`

The pairwise result is returned independently through:

- `ui_bench_winner`: `candidate` for the primary `url`, or `opponent`
- `ui_bench_reason`
- `ui_bench_candidate_mu` and `ui_bench_candidate_sigma`
- `ui_bench_opponent_mu` and `ui_bench_opponent_sigma`
- `ui_bench_opponent_url`
- `ui_bench_evaluator`
- `ui_bench_error`

The update uses the paper's no-draw, no-drift prompt-specific TrueSkill setup.
An arena coordinator can persist the returned state per prompt, use uncertainty
and match quality to schedule more comparisons, then average each tool's
prompt-level `mu` values for a leaderboard.

`ui_bench_evaluator` is currently `vlm_proxy`: UI Judge automates the paper's
blinded forced-choice and rating mechanics with Agent SDK, but does not claim
to reproduce the paper's 194-person expert panel. The existing Lynx runner also
captures its complete available software-renderer viewport rather than an
interactive scrollable full-page presentation. Adaptive tournament scheduling,
multi-rater collection, global persistence, confidence intervals, and the
30-prompt leaderboard remain responsibilities of the calling arena.

The function internally creates the model client from the environment,
connects to headless Lynx, creates and navigates the page, executes steps,
captures the final PNG, and releases the page and Lynx connection. When
UI-Bench is requested, it repeats that lifecycle sequentially for the opponent
before starting the independent model and reference-image evaluations. Model,
runner, page, rating, screenshot-comparison, prompt, and fixture-helper types
are implementation details and are not exported.

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
LYNX_USE_PORT=8080 cargo run -p ui_judge --features server --bin ui-judge-server
```

Build the release server for Linux AMD64 from any directory with:

```bash
packages/genui/ui-judge/build.sh
```

The Cargo build first writes a runnable server layout to
`target/x86_64-unknown-linux-gnu/release`, including the downloaded Lynx
runtime, `lynx_core.js`, and generated launcher. The script copies that layout
to `dist/linux-amd64`:

```text
dist/linux-amd64/
├── ui-judge-server
├── lynx_core.js
├── start.sh
└── lib/
    └── libLynx_clay.so
```

Set `CARGO_TARGET_DIR` to change the intermediate Cargo output directory or
`UI_JUDGE_OUTPUT_DIR` to change the final bundle directory. Cross-compiling
from a different host requires the Rust standard library and a linker for the
`x86_64-unknown-linux-gnu` target.

Start the packaged server with:

```bash
LYNX_USE_PORT=8080 packages/genui/ui-judge/dist/linux-amd64/start.sh
```

`start.sh` resolves the bundle directory independently of the current working
directory, then starts the `ui-judge-server` executable beside it. Model
configuration, credentials, and Lynx runtime configuration continue to come
from the caller's environment. Linux hosts must also provide the
`libepoxy.so.0` system dependency.

`LYNX_USE_PORT` defaults to `8080` and must be between `1` and `65535`. The
process listens on both `0.0.0.0:{LYNX_USE_PORT}` and
`[::]:{LYNX_USE_PORT}`. Use `GET /health` for a readiness check and the
non-secret configured model name, `POST /judge` to evaluate a page, and
`POST /compare` to compare two uploaded images without rendering a page or
calling the VLM.

The following request evaluates a local bundle. `url` and `task` are required.
The other fields are optional. `initialData` and `globalProps` accept JSON
objects and are forwarded only by the HTTP server to the headless Lynx
navigation request; `null` is treated as omitted. The Rust library's public
`JudgePageRequest` remains unchanged.

```bash
curl --request POST http://127.0.0.1:8080/judge \
  --header 'content-type: application/json' \
  --data '{
    "url": "file:///absolute/path/to/dist/main.lynx.bundle",
    "task": "The saved state should be clear and visually correct",
    "globalProps": {
      "messages": [],
      "instant": true,
      "theme": "light"
    },
    "includeGeqi": true,
    "reference": null,
    "referenceImage": null,
    "includeScreenshot": true,
    "steps": ["Tap the Save button"],
    "screenshotSettleMs": 16,
    "timeoutMs": 60000,
    "uiBenchOpponentUrl": "file:///absolute/path/to/opponent/main.lynx.bundle",
    "uiBenchCandidateMu": 25.0,
    "uiBenchCandidateSigma": 8.333333333333334,
    "uiBenchOpponentMu": 25.0,
    "uiBenchOpponentSigma": 8.333333333333334
  }'
```

Omit `uiBenchOpponentUrl` and all four rating fields to run only the original
visual-correctness and optional GEQI dimensions. On the first pairwise match,
the four rating fields may also be omitted to use the paper defaults.
Subsequent match requests should pass the previous response's prompt-specific
`mu` and `sigma` values.

To run only the deterministic image alignment and pixel comparison, upload the
two images as `multipart/form-data`:

```bash
curl --request POST http://127.0.0.1:8080/compare \
  --form 'referenceImage=@/absolute/path/to/reference.png' \
  --form 'renderedImage=@/absolute/path/to/rendered.png'
```

`reference_image` and `rendered_image` are accepted as aliases for clients that
use snake-case form names. The response contains `alignmentScore`,
`visualSimilarity`, `differentBlocks`, `totalBlocks`, `diffImageBase64`, and
any non-fatal `warnings`. This route accepts PNG, JPEG, and WebP image content.
It normalizes and compares the uploads on the bounded visual worker pool; it
does not enqueue headless capture, initialize a model client, render a Lynx
page, or perform VLM scoring.

The `/judge` response contains the JSON-encoded `UiJudgeResult`. When
`includeScreenshot` is true and capture succeeds, it additionally contains the
exact judged PNG as `screenshotDataUrl`; the field is omitted by default to
avoid inflating ordinary responses. A completed evaluation returns HTTP `200`,
including evaluation failures reported in the result's `error` field. Invalid
HTTP input returns `400`, `413`, or `422`. The server returns `503` when its
bounded capture queue is full or the headless worker is no longer available. A
headless-worker panic makes readiness return `503`, initiates graceful
shutdown, and is propagated as a server error after the worker is joined. Each
uploaded comparison image is limited to 10 MiB. Request bodies are limited to
20 MiB plus 64 KiB of multipart overhead.

The server accepts connections concurrently. It keeps native Lynx capture on a
dedicated current-thread runtime because the renderer is thread-bound. After a
capture completes, Tokio runs model scoring concurrently across requests and a
bounded Rayon pool performs CPU-heavy image normalization, alignment, and
comparison. The capture queue holds at most eight requests. Dropped queued
requests release their request data, dropped visual waiters signal cooperative
cancellation, and SIGINT or SIGTERM triggers graceful HTTP shutdown before the
headless worker is joined.

## Model configuration

Set `UI_JUDGE_API_KEY` to authenticate model requests. The other model
environment variables are optional:

- `UI_JUDGE_BASE_URL`
- `UI_JUDGE_MODEL`
- `UI_JUDGE_API_STYLE` (`chat` or `responses`)
- `UI_JUDGE_TIMEOUT_MS`

The model defaults to `gpt-4o-mini`, the Responses API, the OpenAI API base URL,
and a 120-second request timeout. No legacy Midscene- or OpenAI-prefixed model
environment variables or JSON init config are accepted. Both Chat Completions
and Responses wire formats feed Agent SDK structured-output validation. The
legacy `/crawl?ak=` endpoint is Chat-only.

Other user-configurable environment variables are:

- `LYNX_USE_PORT`: HTTP server port; defaults to `8080`.
- `LYNX_LIB_PATH` or `LYNX_SDK_DIR`: override the Lynx runtime library or SDK.
- `LYNX_CORE_JS_PATH`: override `lynx_core.js` when it is not colocated with the
  executable.
- `LYNX_DOWNLOAD_RUNTIME`: enable or disable build-time runtime downloading.
- `LYNX_RUNTIME_URL` and `LYNX_RUNTIME_SHA256`: use and verify a custom
  build-time runtime download.
- `LYNX_SKIP_ADHOC_SIGN`: skip build-time ad-hoc signing on macOS.
- `CARGO_TARGET_DIR`: override Cargo's intermediate output directory.
- `UI_JUDGE_OUTPUT_DIR`: override `build.sh`'s final bundle directory.
- `HEADLESS_RUST_TEST_RUNNER_DEBUG` and `LYNX_HEADLESS_DEBUG`: enable inherited
  headless-runner diagnostics.

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
