# GenUI ReactWeb

Private prompt, source-validation, and build package for React DOM generation.
In Playground, select **ReactWeb → Create** to generate or revise an interface.
The source viewer shows `App.tsx` and `App.css`; the preview updates after the
server compiles and publishes a complete artifact.

The model returns exactly:

```json
{
  "files": {
    "App.tsx": "import { useState } from 'react'; export default function App() { const [count, setCount] = useState(0); return <button onClick={() => setCount(count + 1)}>{count}</button>; }",
    "App.css": "body { margin: 0; font-family: sans-serif; }"
  }
}
```

`App.tsx` may import `react` only and must default-export the root component.
The compiler supplies the entry point, React DOM, and the CSS import. Additional
files, packages, dynamic modules, and model-authored build configuration are
unsupported. Plain browser CSS and local React interactions are supported.

`buildReactWeb` validates the file envelope and compiles in a separate process
without model or storage credentials. It allows two active builds and eight
queued requests per server process, with a 120-second compiler deadline.
Cancellation terminates an active compiler or removes a queued request; temporary
projects are removed on completion. Generated code is compiled without being
executed on the server. React, JavaScript, and CSS are inlined in `index.html`;
the output limit is 16 MiB.

`POST /reactweb/stream` reuses GenUI's selected model, optional search and image
tools, conversation context, usage accounting, and cancellation. SSE sends
`delta`, validated `source`, and `build` status events. Only successful compilation
and TOS publication produce `done.metadata.artifact.webUrl`.

Configure the existing `TOS_ACCESS_KEY`, `TOS_SECRET_KEY`, `TOS_BUCKET`, and
`TOS_REGION` settings. `TOS_REACTWEB_STORAGE_PREFIX` defaults to `reactweb`.
The bucket must allow public reads and CORS from the Playground origin.
Published artifacts use `reactweb/preview/<uuid>/index.html`.

Current, historical, and shared previews use
`render.html?protocol=reactweb&sourceUrl=<artifact.webUrl>`. The outer renderer
downloads the HTML without credentials and renders it in `HtmlView` with
`sandbox="allow-scripts"`. Sources and the artifact URL are persisted with the
assistant turn; follow-up model context contains only the sources.
ReactWeb supports Create, Web preview/share, and Bench, without native Lynx output.

To compare ReactWeb with other protocols, open **Bench**, add a comparison group,
and select **ReactWeb**. The group uses the `native` profile without a catalog.
Bench generates the same two-file source contract, compiles it, and can repair
source or compiler errors. Reports retain the source JSON and generation usage.
Search and image generation are disabled during Bench runs.

With UI Judge enabled, Bench captures the compiled HTML in a sandboxed browser
iframe and scores it through the shared Judge pipeline. Use a browser that
supports Element Capture and share the current tab when prompted by **Start run**.
Keep the page open until the run finishes. ReactWeb-only and mixed HTML/ReactWeb
runs need no screenshot sidecar or TOS publication. Groups using Lynx protocols
still require the configured screenshot service.

Keep this package external in the bundled server: `import.meta.url` must locate
the adjacent worker and this package's dependencies at runtime. Production
installs must include the package and its runtime dependencies.

Run validation from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm turbo build
pnpm exec rstest --project genui/reactweb
```
