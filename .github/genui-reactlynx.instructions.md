---
applyTo: "packages/genui/package.json,packages/genui/index.ts,packages/genui/reactlynx/**,packages/genui/server/**,packages/genui/playground/**"
---

ReactLynx Create uses `/reactlynx/stream` and the shared provider, conversation,
usage, cancellation, and text SSE infrastructure. The model returns JSON with
exactly `files["App.tsx"]` and `files["App.css"]`.
`@lynx-js/genui-reactlynx` owns the generation system prompt, source parsing,
generated entry, dependencies, build API, and Rsbuild worker configuration.
The server owns only model integration, stream orchestration, and publication.
Use `createRsbuild` directly with `pluginReactLynx`; configure bundle filenames
through `pluginLynx` and page options through `pluginLynxConfig`. Never execute
model-authored build configuration, install requested packages, or evaluate
generated JavaScript on the server. Keep generated imports restricted to
`@lynx-js/react`, validate source syntax and module requests in the compiler
worker, and disable CSS filesystem resolution through the Rsbuild plugin API.
Canonicalize the worker's project directory before comparing it with Rspack
issuers so symlinked temporary directories use the same module checks as CI.
Keep authored imports limited to the public package while allowing the exact
internal runtime modules injected by the trusted ReactLynx transform after
source validation. Verify real Web and Native compilation with canonical
temporary paths as well as the host's default temporary directory.

The resolver sees imports after the ReactLynx transforms run. Keep the authored
source policy separate from the compiler runtime allowlist: JSX compilation adds
`@lynx-js/react/internal` and `@lynx-js/react/lepus/jsx-runtime`, and SWC adds
`@swc/helpers/_/_*` helper imports for downlevel syntax, even when the app only
imports `@lynx-js/react`. Compare the issuer against the real path of
`App.tsx`, since Rspack canonicalizes symlinked temporary directories. Exercise
the shipped worker with a real Web/Native build in regression tests; source
policy tests alone do not catch rejected compiler-injected imports.
Source-policy errors should identify the rejected module and its App.tsx line
and column so generated code can be corrected from build diagnostics. Explain
that React hooks come from `@lynx-js/react` and the host already imports
`App.css`; keep these examples in the generation prompt.
When recovering a generated source envelope, only append up to two closing
braces after complete file strings and retain the strict two-file schema and
size limits. Do not complete truncated strings or rewrite code and escapes.

Keep `dist/build-worker.js` beside `dist/index.js` in
`@lynx-js/genui-reactlynx`, and keep that package external in the server build
so `import.meta.url` resolves the worker correctly. Declare `dist/**` as the
package's Turbo build output so cache hits restore both files before server
tests or startup. Run builds in separate Node processes with a credential-free
environment, bounded concurrency, queue, diagnostics, output size, and
lifetime; propagate request cancellation and remove temporary projects. Build
both Web and Native environments and publish every emitted asset with its
relative path intact. Do not emit a successful `done` event until publication
completes, and retain model usage on compilation failures. Report the active
server build interval as `metrics.artifactBuildMs`, excluding queue and
publication time; report publication separately as `artifactUploadMs`.

Keep deployment fixes local to the repository and private applications. Preserve
public packages' dependency declarations and peer compatibility for external
consumers. The Docker image retains the full installed workspace dependency graph,
including development dependencies: runtime compiler packages use peer links that
are also declared as development dependencies. A production-only workspace
reinstall removes those links. Keep the original workspace layout and accept the
larger dependency layer rather than rewriting published dependency contracts.

Keep workspace entry points and published exports intact. Do not add export
conditions solely for deployment. Do not pack tarballs, patch installed manifests,
enable global hoisting, or maintain a manual dependency list for deployment.
The compiler links its adjacent `node_modules` into temporary applications.
Validate deployment changes with a model-free Web/Native compilation through the
server's package resolution after dependency splitting and relocation.

Require the existing TOS configuration and publish every build output under
`reactlynx/preview` before emitting `done`. Honor
`TOS_REACTLYNX_STORAGE_PREFIX` as the optional prefix override. Missing
configuration or any upload failure must fail the generation; do not add a
process-local artifact fallback. Return the public TOS `webUrl` and `nativeUrl`
for current, historical, and shared previews. The TOS bucket must allow
anonymous reads and CORS requests from every deployed Playground origin.

The hook-free ReactLynx chat adapter owns streamed source, build status, and
artifact metadata. Only completed builds update preview. Persist files and
artifact URLs, but do not send artifact metadata back to the model on follow-up
requests. Let `render.html` fetch the TOS `webUrl`, enforce the client-side
bundle size limit, create its Blob URL, and load it directly in `<lynx-view>`.
Bootstrap Lynx Workers through classic Blobs whose `importScripts` resolves
absolute runtime chunk URLs. Playground runtime chunks and WASM must remain
readable by the preview document. The TOS artifact bucket must allow the
`render.html` origin to fetch `main.web.js`.

Use the public TOS `webUrl` as the `bundleUrl` without rewriting the Playground
hostname. Do not route generated bundles through A2UI/OpenUI messages, init
data, or action bridges. Relay the Lynx load event as `A2UI_RENDER_READY` with
the render URL and navigation token for shared preview navigation.

ReactLynx Bench uses the native profile with no catalog. Reuse the two-file
source contract and compiler in bounded generation/repair attempts, retaining
source JSON, model usage and build timing in reports. Package every compiled
asset with its relative path intact into a bounded uncompressed ZIP on the
server. Publish it through TOS under the independent
`reactlynx-bench/preview/<uuid>/bundle.zip` namespace, configurable through
`TOS_REACTLYNX_BENCH_STORAGE_PREFIX`; never reuse Create's publication directory.
Complete publication before emitting a Judge payload, preserve upload timing
and the ZIP URL in adapter metadata, and do not regenerate source after a
storage failure. Screenshot tasks carry only the published ZIP URL and
`entry=main.lynx.js` for `/screenshot/zip/url`, never binary/base64 assets.
Reuse the browser-owned sidecar URL and settle delay, BMP upload, PNG conversion,
and selected-model scoring. Keep ReactLynx out of HTML Element Capture and
A2UI/OpenUI globalProps. Preserve the native source resource checks before
capture, and retain protocol identity in shared plans and restored reports.

Publish the ReactLynx prompt, source helpers, compiler, and types through
`@lynx-js/genui/reactlynx` and the umbrella root. Include `reactlynx/dist/**`,
especially the adjacent compiler worker, in the umbrella tarball and declare
its external compiler dependencies on the published package. Resolve temporary
project node_modules from the nearest installed ancestor that provides
`@lynx-js/react`; the published nested directory has no private workspace
node_modules. Keep bilingual guides package-owned and synchronize ReactLynx
routes through `website/sidebars/genui.ts`.

Run the ReactLynx package suite from the repository root with
`pnpm exec rstest --project genui/reactlynx` after the full Turbo build.
The root `pnpm test` command uses Vitest and does not include this Rstest project.
Keep a real Web/Native compilation regression for the published nested umbrella
layout, with dependencies on the umbrella rather than a private package directory.
