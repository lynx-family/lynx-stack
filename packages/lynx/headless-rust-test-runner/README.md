# Lynx Headless Rust Test Runner

`lynx-headless-rust-test-runner` is a Rust workspace crate that exercises the
runtime-loaded `lynx` engine bridge against a real ReactLynx bundle. It creates
a windowless software renderer, captures the RGBA frame passed to
`SoftwareRenderer::present`, and writes that frame as a PNG. It uses the
compiled fixture output at
`packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle` and a
checked-in `lynx_core.js` resource; the bundle itself is not copied into this
crate.

Build the bundle with the same command used by the UI Judge fixture helper:

```bash
NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build --root packages/genui/ui-judge/tests/fixtures/react
```

The expected first frame is the React fixture UI: an 800x600 viewport with a
black background, a large purple/magenta radial gradient, the Lynx logo, the
arrow image, and white `React` / `on Lynx` text centered in the viewport. The
test asserts those visual signals directly from the captured RGBA frame instead
of comparing a golden image. The fixture inlines PNG assets as
`data:image/...;base64,...`; Clay decodes those images internally, so the runner
does not install a generic resource fetcher for them.

Run the integration target with:

```bash
cargo run -p lynx-headless-rust-test-runner
```

The runner writes a debug PNG to
`target/headless-rust-test-runner/react-fixture.png`. Runtime resolution follows
the `lynx` crate: set `LYNX_LIB_PATH` or `LYNX_SDK_DIR` explicitly, or let the
crate build script download the default supported runtime.

The CI fixture test currently runs on Linux. The same Rust code can be run
locally on macOS as a diagnostic path, but Linux is the runtime-backed contract
for this crate.

If a captured frame contains the gradient and text but has no logo or arrow
pixels, the bundle and Rust task plumbing have already reached first paint. In
that case, check the native windowless runtime: `kRendererTypeSoftware` must
also configure Clay with software image rendering so image resources are painted
into the software present buffer.
