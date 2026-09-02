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
    include_geqi: true,
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

`judge_page` accepts compiled Lynx bundles and UTF-8 `.lynxml` source documents
through `file://`, `http://`, and `https://` URLs. Local pages must use an
absolute `file:///...` URL; bare filesystem paths are rejected before model or
runtime initialization.

`timeout` applies independently to connection, navigation, each natural
language step, final screenshot capture, visual-correctness scoring, every
enabled GEQI dimension, and optional reference-image comparison. It is not an
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

The VLM and reference-image comparison are independent consumers of the final
screenshot. The VLM always receives only that screenshot plus `task` and the
optional textual `reference`; it never receives `reference_image`, alignment
output, pixel-diff output, or algorithmic similarity. Consequently the public
`score`, `reason`, `summary`, `dimensions`, and `geqi_score` fields come from
the VLM evaluations. The `error`
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

The function internally creates the model client from the environment, hands
capture to the bounded queue, and releases the page before the independent VLM
and reference-image evaluations. One dedicated process-owner thread reuses one
`LynxContainer` and drives navigation, steps, and capture synchronously. Model,
runner, page, screenshot-comparison, prompt, and fixture-helper types are
implementation details and are not exported.

`judge_page` is safe to call concurrently from any runtime: native work never
touches the caller's thread. The runner must have its standard runtime resources
installed, including `lynx_core.js` beside the executable on Linux or in
`LynxResources.bundle` on macOS.

The runner captures frames as uncompressed BMP. UI Judge keeps that lossless
copy for the deterministic reference comparison and transcodes to JPEG for every
byte that leaves the process, because vision models do not accept `image/bmp`.

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

### Docker

The package Dockerfile puts a prebuilt Linux AMD64 server bundle and its system
dependencies into an Ubuntu runtime image. Build the bundle with the package
script first. It invokes Cargo, verifies the output from `build.rs`, and copies
the server, Lynx runtime, `lynx_core.js`, and launcher into `dist/linux-amd64`:

```bash
packages/genui/ui-judge/build.sh

docker buildx build \
  --platform linux/amd64 \
  --file packages/genui/ui-judge/Dockerfile \
  --tag ui-judge:local \
  --load \
  packages/genui/ui-judge/dist/linux-amd64
```

The deploy workflow runs the same build script on its native Ubuntu runner and
uploads the verified four-file bundle as a tar artifact. The publishing job
waits for the Rust tests, downloads that exact artifact, and puts it into the
image without compiling Rust again.

Pass model credentials only when starting the container. Production containers
should use a read-only root filesystem and mount the configured `TMPDIR` as a
dedicated `noexec,nosuid,nodev` temporary volume:

```bash
docker run --rm \
  --read-only \
  --tmpfs /tmp/ui-judge:rw,noexec,nosuid,nodev,size=512m,mode=1777 \
  --publish 8080:8080 \
  --env UI_JUDGE_API_KEY \
  ui-judge:local
```

The image runs as UID/GID `65532`, listens on port `8080`, and keeps credentials
out of its layers. Override the port with `LYNX_USE_PORT` and publish the same
container port when a different port is required. A `file://` page URL refers
to a file inside the container, so mount local bundles read-only or use an HTTP
or HTTPS URL.

`LYNX_USE_PORT` defaults to `8080` and must be between `1` and `65535`. The
process listens on both `0.0.0.0:{LYNX_USE_PORT}` and
`[::]:{LYNX_USE_PORT}`. Use `GET /health` for a readiness check and the
non-secret configured model name, `POST /judge` to evaluate a page, and
`POST /screenshot` to render a page without evaluating it. Use `POST /compare`
to compare two uploaded images without rendering a page or calling the VLM.

The following request evaluates a local bundle. `url` and `task` are required.
The other fields are optional. `initialData` and `globalProps` accept JSON
objects and are forwarded only by the HTTP server to the headless Lynx
navigation request; `null` is treated as omitted. `initialData` also applies to
`.lynxml` pages, but `globalProps` does not because the public LynxML load API
does not accept global properties. The Rust library's public `JudgePageRequest`
remains unchanged.

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
    "timeoutMs": 60000
  }'
```

To capture the same page without scoring it, send the same JSON request to
`POST /screenshot`. The response body contains the JPEG, so save it directly to
a file:

```bash
curl --request POST http://127.0.0.1:8080/screenshot \
  --header 'content-type: application/json' \
  --data '{
    "url": "file:///absolute/path/to/dist/main.lynx.bundle",
    "task": "Capture the rendered page",
    "globalProps": {
      "messages": [],
      "instant": true,
      "theme": "light"
    },
    "screenshotSettleMs": 16,
    "timeoutMs": 60000
  }' \
  --output screenshot.jpg
```

`POST /screenshot` accepts the same request fields and aliases as
`POST /judge`. It uses `url`, `initialData`, `globalProps`, `steps`,
`screenshotSettleMs`, and `timeoutMs` for rendering. It ignores
`includeScreenshot`, `includeGeqi`, `reference`, and `referenceImage`. Empty
`steps` do not initialize or call a model. Non-empty `steps` still use Agent SDK
to perform the requested interactions before capture, but the route never
scores the image or compares it with a reference image. A successful response is
`200 image/jpeg` with the transcoded capture.

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
any non-fatal `warnings`. This route accepts BMP, PNG, JPEG, and WebP image
content. It normalizes and compares the uploads on a blocking task; it does not
enqueue headless capture, initialize a model client, render a Lynx page, or
perform VLM scoring.

The `/judge` response contains the JSON-encoded `UiJudgeResult`. When
`includeScreenshot` is true and capture succeeds, it additionally contains the
exact judged image as `screenshotDataUrl`; the field is omitted by default to
avoid inflating ordinary responses. A completed evaluation returns HTTP `200`,
including evaluation failures reported in the result's `error` field. Invalid
HTTP input returns `400`, `413`, or `422`. `POST /screenshot` returns `422` with
a JSON error when rendering cannot produce a frame. The server returns `503` when
its bounded capture queue is full or the headless worker is no longer
available. A headless-worker panic makes readiness return `503`, initiates graceful
shutdown, and is propagated as a server error after the worker is joined. Each
uploaded comparison image is limited to 10 MiB. Request bodies are limited to
20 MiB plus 64 KiB of multipart overhead.

The server accepts connections concurrently. Native Lynx capture runs
sequentially on one dedicated process-owner thread with one reused
`LynxContainer`. After a capture returns its owned BMP, Tokio runs model scoring
concurrently across judge requests and a bounded Rayon pool runs BMP-to-JPEG
transcoding, normalization, alignment, and comparison. This forms a pipeline: scoring an
earlier capture can overlap the next native capture without creating another
native owner. The capture queue holds at most eight requests and reports
backpressure synchronously, so a caller learns the queue is full without first
waiting for the owner. The library and server share the same process-wide
capture broker. Cancelled jobs are purged before reporting a full queue; if the
owner panics, admission closes and queued waiters are released before graceful
HTTP shutdown joins the worker.

### Secure ZIP staging

The `server` feature exposes `ui_judge::server::zip` for server adapters that
accept user-supplied Lynx projects. It does not add an HTTP upload route or
accept a caller-provided base directory. An adapter must stop buffering an
upload at 10 MiB, then hand the bytes to the staging API. The module parses the
content as ZIP regardless of its filename, rejects encrypted or overlapping
archives, symbolic links, and entries other than regular files or directories,
and extracts at most 100 entries, 50 MiB per file, and 100 MiB in total. Both
declared and actually written data are subject to a 100:1 compression-ratio
limit. Paths are enclosed and bounded by depth and byte length, output files use
exclusive creation, and extraction streams through a fixed 64 KiB buffer. A
strict classic outer EOCD and its structural central directory are validated
before the ZIP library runs; ZIP64 metadata and ambiguous visible EOCD fallback
records are rejected while EOCD bytes inside nested file data remain ordinary
content.

At most four extractions run concurrently, and excess work is rejected instead
of queued while retaining another upload buffer. Synchronous ZIP work runs on
Tokio's blocking pool with a ten-second deadline, and the blocking task retains its
permit and temporary-directory guard until it really exits. The successful
result also owns that guard; a future capture integration must move it into the
queued capture job so cancellation cannot remove files while Lynx still uses
them. Dropping the result removes the complete random staging directory, while
failure paths explicitly attempt cleanup and report whether cleanup itself
failed. Nested ZIP entries are left as ordinary files.

Rust limits are only one layer of containment. Production deployments must run
the process as a non-root user with a read-only root filesystem and put
`TMPDIR` on a dedicated `noexec,nosuid,nodev` volume with an ephemeral-storage
quota. Size that quota for four simultaneous 100 MiB extractions plus archive
and filesystem overhead. Log the sanitized rejection kind and byte/count/timing
statistics exposed by the module together with a trusted request ID; do not log
archive entry names or the free-form judging task.

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
  Without `LYNX_CORE_JS_PATH`, an SDK also supplies
  `resources/lynx_core.js`; Cargo downloads it there when missing.
- `LYNX_CORE_JS_PATH`: override the `lynx_core.js` source at runtime and when
  building a server bundle. The bundled destination remains named
  `lynx_core.js`, so a compatible source file may use a different filename.
- `LYNX_CORE_JS_URL` and `LYNX_CORE_JS_SHA256`: use and verify a custom
  build-time core-script download.
- `LYNX_DOWNLOAD_RUNTIME`: enable or disable build-time runtime and core-script
  downloading.
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
headless coverage runs on Linux and macOS. The server test submits four distinct
fixture bundles concurrently through the production single-owner worker and
validates each result; it does not assert timing or throughput.
