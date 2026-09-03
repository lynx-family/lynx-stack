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

`LYNX_USE_PORT` defaults to `8080` and must be between `1` and `65535`. The
process listens on both `0.0.0.0:{LYNX_USE_PORT}` and
`[::]:{LYNX_USE_PORT}`. Use `GET /health` for a readiness check and the
non-secret configured model name. Use `POST /compare` to compare two uploaded
images without rendering a page or calling the VLM. Screenshot capture uses
four source-specific routes:

- `POST /screenshot/zip/upload` accepts a raw ZIP body.
- `POST /screenshot/zip/url` fetches a ZIP from the HTTP(S) URL in its
  `text/plain` body.
- `POST /screenshot/lynxml` accepts a raw UTF-8 LynXML body.
- `POST /screenshot/template/url` fetches a compiled `template.js` from the
  HTTP(S) URL in its `text/plain` body.

Every screenshot route requires the same `entry` query parameter. It may be a
relative staged path such as `pages/index.lynxml` or the equivalent
`zip:///pages/index.lynxml` URL. The server does not expose the former generic
`POST /screenshot` route.

The server does not allow direct `file://`, `http://`, or `https://` page
navigation. `POST /judge` rejects those URL forms with HTTP `403` before model
initialization or headless capture. Use the default library build for trusted
direct-URL judging, or one of the source-specific screenshot routes.

To render a LynXML string without auxiliary local files, send it directly as
the request body. The endpoint accepts `application/xml`, `text/xml`, and
`text/plain`, buffers at most 10 MiB, and returns `image/jpeg` with
`Cache-Control: no-store`:

```bash
curl --request POST 'http://127.0.0.1:8080/screenshot/lynxml?entry=pages%2Findex.lynxml' \
  --header 'content-type: application/xml; charset=utf-8' \
  --data-binary '<lynx engine-version="4.2"><script thread="main">/* ... */</script></lynx>' \
  --output screenshot.jpg
```

The server stages the source at the requested entry in a fresh private
directory and renders it through the equivalent internal `zip:///` URL in the
same isolated process pool as ZIP inputs. HTTP(S) resources with domain hosts
remain available, while `file://`, IP-hosted HTTP(S), and paths outside that
private directory remain blocked. Use a ZIP endpoint when the document needs
relative image or script files.

To render an uploaded ZIP without scoring it, send the archive itself as the
request body and pass its entrypoint through `entry`. The route does not accept
a caller-supplied base directory, model options, or interaction steps:

```bash
curl --request POST 'http://127.0.0.1:8080/screenshot/zip/upload?entry=index.lynxml' \
  --header 'content-type: application/zip' \
  --data-binary '@/absolute/path/to/page.zip' \
  --output screenshot.jpg
```

The entry must be a safe relative file path inside the archive. That document
may use paths relative to itself, such as `./images/logo.png`, or archive-root URLs such as
`zip:///images/logo.png`. Local paths resolve only within the new private
extraction directory created for that request. Explicit `file://` URLs and
HTTP(S) URLs with IP address hosts are rejected; HTTP(S) resources with domain
hosts remain available. A successful response is `200 image/jpeg` with
`Cache-Control: no-store`.

To fetch the same ZIP remotely, send its URL as the plain-text request body:

```bash
curl --request POST 'http://127.0.0.1:8080/screenshot/zip/url?entry=index.lynxml' \
  --header 'content-type: text/plain; charset=utf-8' \
  --data-binary 'https://cdn.example.com/page.zip' \
  --output screenshot.jpg
```

The template URL route uses the same request shape, with an entry such as
`main/template.js`. Both URL routes use the shared SSRF-safe downloader. It
accepts only HTTP(S) URLs without credentials, disables redirects and ambient
proxies, resolves DNS before connecting, pins the validated addresses for the
request, and rejects any host that resolves to a non-public address. Remote
responses are limited to 10 MiB; URL request bodies are limited to 8 KiB.

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

`POST /judge` returns `403` for direct `file://` or HTTP(S) page URLs. The
source-specific screenshot routes return `422` with a JSON error when rendering
cannot produce a frame. Uploads and remote responses return `413` when they
exceed 10 MiB. Invalid upload media types return `415`, while a rejected remote
network target returns `403`. Body reading and isolated rendering return `408`
when they exceed their deadlines; remote fetches return `504`. ZIP processing
also applies its ten-second extraction deadline. A busy bounded queue keeps the
HTTP callback pending until capacity becomes available or that deadline
expires; eager load shedding belongs in an outer middleware. The server returns `503` when the
headless worker is shutting down or no longer available. A headless-worker panic
makes readiness return `503`, initiates graceful shutdown, and is propagated as
a server error after the worker is joined. Each ZIP upload and each uploaded
comparison image is limited to 10 MiB. Other request bodies are limited to 20
MiB plus 64 KiB of multipart overhead.

Trusted library captures run sequentially on one dedicated process-owner thread
with one reused `LynxContainer`. After a capture returns its owned BMP, Tokio can
run model scoring concurrently while the bounded Rayon pool handles BMP-to-JPEG
transcoding, normalization, alignment, and comparison. The capture queue holds
at most eight requests. When it is full, the caller waits asynchronously within
its request timeout, without blocking a Tokio worker thread. If the owner panics,
admission closes and queued or capacity-waiting callers are released before the
worker is joined.

Uploaded ZIP pages are deliberately different. Each one is rendered by a fresh,
short-lived `ui-judge-server` child process with its own `LynxContainer`, so
native process-global image caches cannot return another upload's bytes. The
child receives only the server-selected staging root and output path, inherits
no model credentials, and sends no request output to stdout or stderr. A private
stdin lifeline makes the child exit if its parent dies. Cancellation and timeout
kill and reap the child before its render slot and staged tree are released;
graceful shutdown drains accepted children. Failure to confirm reaping exits the
service without unwinding the staging guard after a fixed five-second reap grace
so its supervisor can restart it. This fail-closed exit does not request a core
dump. The same absolute deadline also covers output reading and JPEG
transcoding.

### Secure ZIP staging

The `server` feature exposes `ui_judge::server::zip` for server adapters that
accept user-supplied Lynx projects and backs both ZIP screenshot routes. The
upload route buffers the raw request body with a ten-second deadline, stops at
10 MiB, and never accepts a caller-provided base directory. The URL route
applies the same byte limit before passing the response to the staging module.
It then waits asynchronously for isolated-render capacity before extracting. The
module parses the content as ZIP regardless of its filename, rejects encrypted
or overlapping archives, symbolic links, and entries other than regular files
or directories, and extracts at most 100 entries, 50 MiB per file, and 100 MiB
in total. Both declared and actually written data are subject to a 100:1
compression-ratio limit. Paths are enclosed and bounded by depth and byte
length, output files use exclusive creation, and extraction streams through a
fixed 64 KiB buffer. A strict classic outer EOCD and its structural central
directory are validated before the ZIP library runs; ZIP64 metadata and
ambiguous visible EOCD fallback records are rejected while EOCD bytes inside
nested file data remain ordinary content.

At most four ZIP requests may pass the isolated-render capacity gate at once.
When every slot is busy, the HTTP callback waits until a slot becomes available
or its operation deadline expires; an outer middleware must implement any
earlier load shedding. Acquiring the slot before extraction keeps staged trees
within the same four-job bound. Synchronous ZIP work runs on Tokio's blocking
pool with a separate four-permit semaphore and its own ten-second absolute
deadline. A blocking extraction retains its permit until it really exits, while
a successful result owns its temporary-directory guard. The ZIP screenshot
route moves that guard and the render slot into a one-shot child-process
supervisor, so cancellation cannot remove files while Lynx still uses them. The
supervisor first kills and reaps a cancelled or timed-out child, then drops the
guard and render slot. Graceful server shutdown waits
for every supervisor. Dropping the result removes the complete random staging
directory, while failure paths explicitly attempt cleanup and report whether
cleanup itself failed. Nested ZIP entries are left as ordinary files.

Rust limits are only one layer of containment. Production deployments must run
the process as a non-root user with a read-only root filesystem and put
`TMPDIR` on a dedicated `noexec,nosuid,nodev` volume with an ephemeral-storage
quota. Size that quota for four simultaneous 100 MiB extractions plus archive
and filesystem overhead. Apply container or cgroup CPU, memory, and process
limits to the server and its four possible renderer children; the Rust deadline
does not prevent an allocation spike before it expires. Disable core dumps for
the service account as defense in depth. Log the sanitized
rejection kind, render outcome, and byte/count/timing statistics together with
the server-generated process/job ID; do not log archive entry names or the
free-form judging task.

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
