# UI Judge

`ui_judge` provides headless Lynx screenshots and deterministic image comparison.
GenUI Server owns model evaluation, prompts, scoring, and model configuration.
It converts captured BMP frames to PNG and evaluates them with the selected GenUI
model, using the existing GenUI provider configuration and default selection.

## Rust API

The default build is library-only. Capture a trusted local or HTTP(S) page,
then compare its pixels with a baseline:

```rust,no_run
use ui_judge::{capture_page, compare_images, CapturePageRequest};

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
  let bmp = capture_page(CapturePageRequest {
    url: "file:///absolute/path/to/main.lynx.bundle".into(),
    ..Default::default()
  }).await?;
  let baseline = std::fs::read("reference.bmp")?;
  let comparison = compare_images(&baseline, &bmp).await?;
  println!("Similarity: {}", comparison.similarity);
  Ok(())
}
```

`CapturePageRequest` accepts `url`, `screenshot_settle`, `timeout`,
`global_props_json`, and `initial_data_json`. The defaults are 16 ms of screenshot
settling and a 60-second operation timeout. URLs must use `file://`, `http://`,
or `https://`; bare paths are rejected before runtime initialization. Compiled
Lynx bundles and UTF-8 `.lynxml` documents use the existing headless runner.
Native work stays on a dedicated thread that owns the container and page
lifecycle, so callers can use any Tokio runtime.

`capture_page` returns the original uncompressed BMP bytes. `compare_images`
accepts two byte slices containing BMP images and returns
alignment, similarity, block counts, a base64 BMP diff, and warnings. Input bytes,
dimensions, and allocations are bounded. Each BMP is decoded once; alignment and
pixel comparison pass RGBA buffers directly on a bounded Rayon pool. Only the
final diff is encoded as BMP; the comparison pipeline has no PNG codec dependency
or intermediate image encoding. Comparison preserves raw RGBA channels, including
transparent pixels.

The crate has no model client, scoring API, interaction planner, or model
configuration. `CapturePageError` reports capture failures;
`VisualEvaluationError` and `VisualEvaluationErrorCode` report comparison errors.
The `server` feature additionally exposes the HTTP adapter.

## HTTP server

Turn on the `server` feature to serve UI Judge over HTTP:

```bash
LYNX_USE_HOST=127.0.0.1 LYNX_USE_PORT=8080 \
  cargo run -p ui_judge --features server --bin ui-judge-server
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
LYNX_USE_HOST=127.0.0.1 LYNX_USE_PORT=8080 \
  packages/genui/ui-judge/dist/linux-amd64/start.sh
```

`start.sh` resolves the bundle directory independently of the current working
directory, then starts the `ui-judge-server` executable beside it. Lynx runtime
configuration comes from the caller's environment. Linux hosts must also provide the
`libepoxy.so.0` system dependency.

`LYNX_USE_PORT` defaults to `8080` and must be between `1` and `65535`. When
`LYNX_USE_HOST` is unset, the process listens on both
`0.0.0.0:{LYNX_USE_PORT}` and `[::]:{LYNX_USE_PORT}`. Set `LYNX_USE_HOST` to
an IPv4 address, IPv6 address, or hostname to bind only its resolved address.
Use `GET /health` for a readiness check returning `{"status":"ok"}`. Use `POST /compare` to compare two uploaded images without rendering a
page or calling the VLM. Screenshot capture uses four source-specific routes:

All four screenshot routes accept `multipart/form-data`. Put every parameter in
a named part; query parameters and the former raw request bodies are rejected.

| Route                           | Required source part                 |
| ------------------------------- | ------------------------------------ |
| `POST /screenshot/lynxml`       | `source`: UTF-8 LynXML text or file  |
| `POST /screenshot/template/url` | `url`: HTTP(S) compiled-template URL |
| `POST /screenshot/zip/upload`   | `file`: ZIP archive bytes            |
| `POST /screenshot/zip/url`      | `url`: HTTP(S) ZIP URL               |

All four source-specific routes accept these additional parts:

| Part          | Required | Value                                                                                                |
| ------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `entry`       | Yes      | Relative staged path such as `pages/index.lynxml`, or the equivalent `zip:///pages/index.lynxml` URL |
| `width`       | No       | Viewport width in pixels; defaults to `800`                                                          |
| `height`      | No       | Viewport height in pixels; defaults to `600`                                                         |
| `globalProps` | No       | JSON object passed as global properties when loading a compiled template                             |
| `initData`    | No       | JSON object passed as initial page data                                                              |

Both dimensions must be between 1 and 8192, and `width × height` must not exceed
2,621,440 pixels. Omit page-data parts to use the runtime defaults. JSON parts
accept objects, including nested values; arrays, scalars, and `null` are rejected.
LynXML supports `initData` but its native loading API does not support
`globalProps`. An explicit `globalProps` part with a `.lynxml` entry returns `400`,
including for ZIP sources. Compiled-template entries support both parts.

Parts may appear in any order. Duplicate, unknown, and missing required parts
return `400`. All part contents share a 10 MiB limit, with another 64 KiB allowed
for multipart framing. The complete body has a ten-second read deadline.
The server does not expose the former generic screenshot route, `POST /screenshot`.

For a compiled remote template with injected page data, use
`POST /screenshot/template`. It accepts only `url`, `globalProps`, `initialData`,
`screenshotSettleMs`, and `timeoutMs` in a JSON body. The server fetches the
HTTP(S) template through the shared SSRF-safe downloader, stages it privately,
and captures it in a fresh child process. Direct `file://` URLs, unknown fields,
and interaction steps are rejected. Successful responses contain the original
BMP with `Content-Type: image/bmp` and `Cache-Control: no-store`.

```bash
curl --request POST http://127.0.0.1:8080/screenshot/template \
  --header 'content-type: application/json' \
  --data '{
    "url": "https://cdn.example.com/a2ui.lynx.js",
    "globalProps": {"messages": []},
    "screenshotSettleMs": 1000
  }' \
  --output screenshot.bmp
```

GenUI Server uses this endpoint before its screenshot evaluation. The former
`POST /judge` endpoint has been removed; model credentials and scoring requests
belong in GenUI Server.

To render a LynXML string without auxiliary local files, send a `source` part.
A successful response is `image/bmp` with `Cache-Control: no-store`:

```bash
curl --request POST http://127.0.0.1:8080/screenshot/lynxml \
  --form-string 'entry=pages/index.lynxml' \
  --form-string 'width=375' \
  --form-string 'height=812' \
  --form-string 'initData={"title":"Preview"}' \
  --form-string 'source=<lynx engine-version="4.2"><script thread="main">/* ... */</script></lynx>' \
  --output screenshot.bmp
```

The server stages the source at the requested entry in a fresh private
directory and renders it through the equivalent internal `zip:///` URL in the
same isolated process pool as ZIP inputs. HTTP(S) resources with domain hosts
remain available, while `file://`, IP-hosted HTTP(S), and paths outside that
private directory remain blocked. Use a ZIP endpoint when the document needs
relative image or script files.

To render an uploaded ZIP without scoring it, send the archive in `file` and
its entrypoint in `entry`. The route does not accept a caller-supplied base
directory, model options, or interaction steps:

```bash
curl --request POST http://127.0.0.1:8080/screenshot/zip/upload \
  --form-string 'entry=template.js' \
  --form 'file=@/absolute/path/to/page.zip;type=application/zip' \
  --form-string 'globalProps={"theme":"dark"}' \
  --form-string 'initData={"title":"Preview"}' \
  --output screenshot.bmp
```

The entry must be a safe relative file path inside the archive. That document
may use paths relative to itself, such as `./images/logo.png`, or archive-root URLs such as
`zip:///images/logo.png`. Local paths resolve only within the new private
extraction directory created for that request. Explicit `file://` URLs and
HTTP(S) URLs with IP address hosts are rejected; HTTP(S) resources with domain
hosts remain available. A successful response is `200 image/bmp` with
`Cache-Control: no-store`.

To fetch a ZIP remotely, send its URL in `url`:

```bash
curl --request POST http://127.0.0.1:8080/screenshot/zip/url \
  --form-string 'entry=index.lynxml' \
  --form-string 'url=https://cdn.example.com/page.zip' \
  --form-string 'initData={"title":"Preview"}' \
  --output screenshot.bmp
```

To render a remote compiled template with global properties and initial data:

```bash
curl --request POST http://127.0.0.1:8080/screenshot/template/url \
  --form-string 'entry=main/template.js' \
  --form-string 'url=https://cdn.example.com/template.js' \
  --form-string 'globalProps={"theme":"dark"}' \
  --form-string 'initData={"title":"Preview"}' \
  --output screenshot.bmp
```

For large JSON objects, read the part from a file, for example
`--form 'globalProps=</absolute/path/to/global-props.json;type=application/json'`.
Let your HTTP client generate the multipart boundary and `Content-Type` header.

Both URL routes use the shared SSRF-safe downloader. It accepts only HTTP(S)
URLs without credentials, disables redirects and ambient proxies, resolves DNS
before connecting, pins the validated addresses for the request, and rejects
any host that resolves to a non-public address. Remote responses are limited
to 10 MiB; `url` parts are limited to 8 KiB.

To run only the deterministic image alignment and pixel comparison, upload the
two BMP images as `multipart/form-data`:

```bash
curl --request POST http://127.0.0.1:8080/compare \
  --form 'referenceImage=@/absolute/path/to/reference.bmp;type=image/bmp' \
  --form 'renderedImage=@/absolute/path/to/rendered.bmp;type=image/bmp'
```

`reference_image` and `rendered_image` are accepted as aliases for clients that
use snake-case form names. The response contains `alignmentScore`,
`visualSimilarity`, `differentBlocks`, `totalBlocks`, `diffImageBase64`, and
any non-fatal `warnings`. Both uploads must contain valid BMP bytes. PNG, JPEG,
WebP, and malformed images return `400`, even if their filename or part media
type claims BMP. The server validates the bytes rather than the upload metadata.
It decodes each BMP once and compares RGBA buffers on the bounded Rayon pool;
`diffImageBase64` contains base64-encoded BMP bytes without a data-URL prefix.
Clients that display the diff as a data URL must use `data:image/bmp;base64,`.

Remote-source routes reject non-HTTP(S) URLs with `400` and non-public network
addresses with `403`. The source-specific
screenshot routes return `422` with a JSON error when rendering cannot produce
a frame. Uploads and remote responses return `413` when they exceed 10 MiB.
Invalid upload media types return `415`. Body reading and isolated rendering
return `408` when they exceed their deadlines; remote fetches return `504`. ZIP
processing also applies its ten-second extraction deadline. A busy bounded queue keeps the
HTTP callback pending until capacity becomes available or that deadline
expires; eager load shedding belongs in an outer middleware. The server returns `503` when the
headless worker is shutting down or no longer available. A headless-worker panic
makes readiness return `503`, initiates graceful shutdown, and is propagated as
a server error after the worker is joined. Each ZIP upload and each uploaded
comparison image is limited to 10 MiB. Other request bodies are limited to 20
MiB plus 64 KiB of multipart overhead.

Trusted library captures run sequentially on one dedicated process-owner thread
with one reused `LynxContainer`. Image comparison runs concurrently on a bounded
Rayon pool. The capture queue holds
at most eight requests. When it is full, the caller waits asynchronously within
its request timeout, without blocking a Tokio worker thread. If the owner panics,
admission closes and queued or capacity-waiting callers are released before the
worker is joined.

Untrusted staged pages, including remote templates submitted to `/screenshot/template`, are
deliberately different. Each one is rendered by a fresh, short-lived
`ui-judge-server` child process with its own `LynxContainer`, so native
process-global image caches cannot return another request's bytes. The child
receives only server-selected paths and page-load data, inherits no model
credentials, and sends no request output to stdout or stderr. A private
stdin lifeline makes the child exit if its parent dies. Cancellation and timeout
kill and reap the child before its render slot and staged tree are released;
graceful shutdown drains accepted children. Failure to confirm reaping exits the
service without unwinding the staging guard after a fixed five-second reap grace
so its supervisor can restart it. This fail-closed exit does not request a core
dump. The same absolute deadline also covers output reading.

### Secure ZIP staging

The `server` feature exposes `ui_judge::server::zip` for server adapters that
accept user-supplied Lynx projects and backs both ZIP screenshot routes. The
upload route reads multipart parts with a ten-second deadline and a shared
10 MiB content limit, plus 64 KiB for framing. It never accepts a caller-provided
base directory. The URL route
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

## Runtime configuration

- `LYNX_USE_HOST`: optional HTTP server bind address or hostname; when unset,
  listens on both IPv4 and IPv6 unspecified addresses.
- `LYNX_USE_PORT`: HTTP server port; defaults to `8080`.
- `LYNX_LIB_PATH` or `LYNX_SDK_DIR`: override the Lynx runtime library or SDK.
  Without `LYNX_CORE_JS_PATH`, an SDK also supplies
  `resources/lynx_core.js`; Cargo downloads it there when missing.
- `LYNX_CORE_JS_PATH`: override the `lynx_core.js` source at runtime and when
  building a server bundle. The bundled destination remains named
  `lynx_core.js`, so a compatible source file may use a different filename.
- `CUSTOM_LYNX_CORE_JS_URL` and `CUSTOM_LYNX_CORE_JS_SHA256`: use and verify a custom
  build-time core-script download.
- `LYNX_DOWNLOAD_RUNTIME`: enable or disable build-time runtime and core-script
  downloading.
- `CUSTOM_LYNX_RUNTIME_URL` and `CUSTOM_LYNX_RUNTIME_SHA256`: use and verify a custom
  build-time runtime download.
- `LYNX_SKIP_ADHOC_SIGN`: skip build-time ad-hoc signing on macOS.
- `CARGO_TARGET_DIR`: override Cargo's intermediate output directory.
- `UI_JUDGE_OUTPUT_DIR`: override `build.sh`'s final bundle directory.
- `HEADLESS_RUST_TEST_RUNNER_DEBUG` and `LYNX_HEADLESS_DEBUG`: enable inherited
  headless-runner diagnostics.

## Tests

From the workspace root, install and build repository dependencies, generate
the React fixture, then run the Rust tests. Runtime coverage captures and
compares real frames without model credentials:

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
