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
LYNX_HEADLESS_RUST_EXTERNAL_ASSETS=1 NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build --root packages/genui/ui-judge/tests/fixtures/react
```

The expected first frame is the React fixture UI: an 800x600 viewport with a
black background, a large purple/magenta radial gradient, the Lynx logo, the
arrow image, and white `React` / `on Lynx` text centered in the viewport. The
test asserts those visual signals directly from the captured RGBA frame instead
of comparing a golden image. The external-assets build mode keeps the UI Judge
fixture default unchanged while avoiding `data:image` URLs that the current
macOS windowless runtime does not route through the generic resource fetcher.

Run the integration target with:

```bash
cargo run -p lynx-headless-rust-test-runner
```

The runner writes a debug PNG to
`target/headless-rust-test-runner/react-fixture.png`. Runtime resolution follows
the `lynx` crate: set `LYNX_LIB_PATH` or `LYNX_SDK_DIR` explicitly, or let the
crate build script download the default supported runtime.

The CI fixture test currently runs on Linux. The shipped macOS windowless
runtime can present the software frame locally, but this runtime currently does
not paint PNG `<image>` nodes into that frame even when the bundle uses
absolute `file://` asset URLs. Keep the macOS run as a diagnostic path until
the runtime exposes image painting for the windowless software backend.
