---
applyTo: "packages/genui/reactlynx/**,packages/genui/server/**,packages/genui/playground/**"
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

Changing only the compiler worker's direct external imports to plugin `dist`
entries does not make a production-only workspace install complete. The React
plugin's published bundle still imports the React alias plugin by package name,
which selects its workspace `lib` entry and can fail on the omitted development
dependency `semver`. Even redirecting transitive Rsbuild plugins to their published
entries leaves peer resolution to validate: a production workspace install can
omit the template plugin link required by `react-webpack-plugin`. Validate the
complete runtime dependency graph with a real production-only install and a
Web/Native compilation; do not treat successful worker bundling as proof that the
deployed compiler works.

The Docker build uses `pnpm deploy --prod` for the compiler's production and
peer dependency graph, then places it at the workspace package path after the
production reinstall. Workspace Rsbuild plugins expose `dist` through the
`production` export condition; the compiler worker must pass
`--conditions=production` explicitly because `NODE_ENV` does not activate it.
Keep the default workspace development entries and published exports intact.
Do not pack tarballs, patch installed manifests, or maintain a manual dependency
list for deployment.
Keep this deployment at the package root: the compiler links its adjacent
`node_modules` into temporary applications. Do not move it into a nested dependency
location without revisiting that assumption. Validate deployment changes with a
model-free Web/Native compilation through the server's package resolution.

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
