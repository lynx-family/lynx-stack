# ReactLynx overview and architecture

The model authors a ReactLynx function component and plain CSS. The host owns the
entry point, compiler configuration, runtime dependencies, and bundle loading.
Unlike A2UI Catalogs or OpenUI Libraries, this integration uses generated source
code and requires compilation before rendering.

## Generation flow

1. Send `REACTLYNX_SYSTEM_PROMPT` and the user's request to your model.
2. Accumulate response deltas and parse the complete response with `parseReactLynxSource`.
3. Call `buildReactLynx` on Node.js with an `AbortSignal` and a progress callback.
4. Publish all emitted assets, preserving their relative paths.
5. Load the corresponding Web or Native entry bundle in your Lynx host.

The host supplies `root.render(<App />)` and imports `App.css`. Generated code
imports only `@lynx-js/react`. It uses Lynx elements, React state, and Lynx event
handlers to implement interactions locally within the page.

## Application responsibilities

Keep model credentials and storage access on your backend. Connect cancellation
to the build's `AbortSignal`, show compilation diagnostics, and update the preview
only after a completed build has been published. For follow-up edits, send the
previous source with the request and ask for both complete files again.

The compiler uses a separate child process with a restricted environment and
bounded resources. It validates source syntax and import requests before
compiling, and executes only host-owned build configuration. These checks do not
turn generated code into a component allowlist or a general runtime sandbox;
your host controls where generated bundles can run.

See [source and builds](./source-guide.md) and [system prompts](./system-prompts.md).
