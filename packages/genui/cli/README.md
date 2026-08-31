# GenUI CLI

`@lynx-js/genui-cli` is the command line entry point for GenUI workflows. It is
structured by namespace so A2UI and OpenUI workflows can share one package and
binary.

## Usage

```bash
genui <namespace> <command> [options]
```

Available namespaces:

- `a2ui`: generate A2UI catalog artifacts and system prompts.
- `openui`: generate OpenUI system prompts.
- `playground`: run the local Lynx XML Agent Playground.

The package also exposes `genui-cli` as an alias. `a2ui-cli` remains available as
a compatibility alias for existing A2UI-only scripts.

## A2UI Commands

Create a new A2UI project:

```bash
genui a2ui create my-a2ui-app
```

Generate a system prompt with the built-in A2UI basic catalog:

```bash
genui a2ui generate prompt --out dist/a2ui-system-prompt.txt
```

Generate catalog artifacts for a custom catalog:

```bash
genui a2ui generate catalog \
  --catalog-dir src/catalog \
  --source src/functions \
  --out-dir dist/catalog
```

Generate a system prompt for a custom catalog:

```bash
genui a2ui generate prompt \
  --catalog-dir dist/catalog \
  --catalog-id https://example.com/catalogs/custom/v1/catalog.json \
  --out dist/a2ui-system-prompt.txt
```

`generate prompt` uses the built-in A2UI basic catalog by default. Pass
`--catalog-dir` only when generating a prompt for custom generated catalog
artifacts. When `--catalog-dir` is provided, the directory must contain files
like `<Component>/catalog.json`.

## OpenUI Commands

Generate an OpenUI system prompt:

```bash
genui openui generate prompt --out dist/openui-system-prompt.txt
```

`generate prompt` uses the bundled OpenUI prompt library. Useful options:

- `--out <file>`: write the prompt to a file instead of stdout.
- `--appendix <text>`: append extra instructions to the generated prompt.

### `genui a2ui create`

Creates a new ReactLynx A2UI project from the bundled template.

```bash
genui a2ui create my-a2ui-app
cd my-a2ui-app
pnpm install
pnpm run dev
```

Useful options:

- `[project-name]`: target directory name. Defaults to `my-a2ui-app`.
- `--template <name>`: template to use. Defaults to `default`.

The target directory must be empty. The generated `package.json` replaces the
template workspace dependency placeholders with installable package versions
resolved from the parent `@lynx-js/genui` package metadata.

### `genui a2ui generate catalog`

Delegates catalog extraction to `@lynx-js/genui/a2ui-catalog-extractor`.

Useful options:

- `--catalog-dir <dir>`: directory to scan for TypeScript component catalog
  interfaces. Defaults to `src/catalog`.
- `--source <path>`: source file or directory to scan for catalog functions.
  Repeatable.
- `--typedoc-json <file>`: read an existing TypeDoc JSON project.
- `--out-dir <dir>`: output directory for generated catalog artifacts. Defaults
  to `dist/catalog`.

### `genui a2ui generate prompt`

Delegates prompt construction to `@lynx-js/genui/a2ui-prompt`.

Useful options:

- `--catalog-dir <dir>`: generated catalog artifact directory. Omit this option
  to use the built-in A2UI basic catalog.
- `--catalog-id <id>`: catalog id to require in `createSurface` messages.
  Defaults to the built-in A2UI basic catalog id.
- `--out <file>`: write the prompt to a file instead of stdout.
- `--appendix <text>`: append extra instructions to the generated prompt.

## Compatibility

Existing A2UI commands still work:

```bash
a2ui-cli generate catalog --catalog-dir src/catalog --out-dir dist/catalog
a2ui-cli generate prompt --out dist/a2ui-system-prompt.txt
```

New scripts should prefer `genui a2ui ...`.

## Local Lynx XML Agent Playground

`genui playground` starts a foreground daemon and opens its local control page
at `http://127.0.0.1:58321`:

```bash
genui playground
```

Options:

- `--no-open` prints the one-time bootstrap URL instead of opening it.
- `--port <number>` selects the control port.
- `--data-dir <path>` overrides the private conversation directory.

Starting the command again with the same data directory asks the running daemon
for a fresh one-time URL. Press Ctrl+C to stop the daemon and every Agent process
group it manages.

The local page uses the same React chrome, conversation workspace, transcript,
composer, artifact viewer, Preview shell, Examples pages, and canonical CSS as
the hosted GenUI Playground. The local-only slice is limited to Agent, model,
and effort selection, approval and Stop state, Daemon HTTP/SSE transport, and
local privacy/error copy. Share and Delete remain in their normal positions but
are disabled locally; New, Switch, Rename, Create, and Examples work normally.

The playground currently runs on macOS and supports exactly these local Agent
commands:

- Codex: `codex app-server --stdio`
- Claude Code: bidirectional `claude -p` stream JSON
- Cursor Agent: `cursor-agent acp`
- Trae CLI: `traecli acp serve`

The daemon detects whether each executable is present and authenticated. It does
not install tools, log in, change Agent configuration, add bypass flags, or
approve requests. The single settings pill is ordered Agent, Model, then Effort.
Codex, Cursor Agent, and Trae CLI model choices are discovered asynchronously
from the installed CLI and cached briefly; model discovery never delays daemon
startup. Claude Code does not expose a model-list command, so its disabled
`Agent default` choice inherits the user's Claude configuration. A missing or
unauthenticated Agent remains visible but is disabled.

Conversations, turns, events, and artifacts are persisted with private
permissions. The final assistant response is the only authoritative artifact;
streaming text never creates an executable revision. Cancellation revokes the
turn lease before terminating the native session and process group, so late
events cannot overwrite the previous artifact or leak into the next turn.

The authenticated control page and generated code use separate origins:

- Control: `127.0.0.1:<controlPort>`
- Preview: `localhost:<independent dynamic port>`

The Preview has no daemon cookie or API surface. Each artifact gets a fresh
sandboxed iframe and a revision-bound, hash-checked, one-shot message. Host,
Origin, CSRF, symlink, path, payload, and event limits are enforced by the
daemon. Generated content and all Examples content, including edited source,
use this isolated Preview path. The hosted GenUI/Mastra transport, IndexedDB,
Share/Delete behavior, and routes remain unchanged.

Assistant streaming coalesces small protocol deltas before SSE delivery. The
Daemon independently bounds the actual Agent queue and durable event log; a
backpressured browser connection is disconnected and restored from its snapshot
without failing the active Agent turn.

Maintainer probes, run after a full repository build:

```bash
pnpm -C packages/genui/cli probe:agents
pnpm -C packages/genui/cli test:playground:ui-conformance
pnpm -C packages/genui/cli probe:preview:isolation
pnpm -C packages/genui/cli test:playground:browser-security
```

The read-only Agent probe checks installation and authentication without
generating. The packaged fake-Agent suite deterministically exercises streaming,
admission retry, immediate and pending-approval cancellation, `allow_once`,
`deny`, unique terminal events, late-event isolation, and orphan cleanup through
the daemon, HTTP/SSE, control UI, and Playwright.

The opt-in real probe can consume provider capacity and run trusted local tools:

```bash
pnpm -C packages/genui/cli probe:agents:real
```

It performs generate, iterate, Stop, terminal, approval, and process cleanup
checks for all four Agents through a packed tarball. Set
`GENUI_AGENT_PROBE_REPORT=<path>` to write its diagnostic JSON report. The report
is not read by the product runtime.
