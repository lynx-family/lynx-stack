# error-remapping

Regression tests that reverse Lynx red-screen error stacks back to source,
against THIS example's build. Runs on `rstest`, all TypeScript.

Approach (no recorded device stacks): infer the generated column each engine
reports for a crash directly from the CURRENT build's `debug-metadata.json`,
reverse it with the same column convention as the backend, and snapshot the
result. Because everything is derived from the current build, a
build/plugin/reversal regression shows up as a snapshot diff, and editing the
demo never needs device re-recording — just `pnpm test:update`.

## Engine model

Each crash reduces to one failing identifier — the callee of a `throw Error(...)`
/ `obj.method()`, the property being read, or an undefined global variable. Where
each engine points depends on the crash class: **call** / **read** / **global**.

| engine  | call (throw / method)     | read (property) | global (undefined var) |
| ------- | ------------------------- | --------------- | ---------------------- |
| v8      | callee start              | token end       | token end              |
| jsc     | callee end (`(`)          | token end       | token end              |
| quickjs | call-expr end (after `)`) | property start  | module top             |

QuickJS is the odd one out: a call reports its return address (after `)`), a read
reports the property itself, and an undefined-global ReferenceError reports the
module top (no real mapping → reverses to null). Reversal itself is
engine-agnostic (`colno - 1` in, `+ 1` out, faithful to the source map); the
per-engine difference is only in which generated column the engine reports. See
`anchor()` / `callExprEnd()` in `infer.ts`.

A case gives a `token` (the failing identifier, a substring unique in the
generated bundle) plus its `err` class; the per-engine column falls out of the
token's start / end / call-expr end / module top.

## Files

```
cases.ts        每个 demo 崩溃按钮: { name, kind, err, find, token } | { name, kind:'main-thread', marker }
infer.ts        background frames: locate the token, pick the column by engine + err
mainThread.ts        main-thread frames: invert bytecode-debug-info → (function_id, pc) → 2-step reverse
remap-lib.ts    reversal lib (colno-1 in / +1 out; ±5 context lines, long lines clipped)
frames.ts       computeFrame: one case+engine → backend-shaped frame
runEngine.ts    parameterised run of every case for one engine
test/           remap.{jsc,v8,quickjs}.test.ts → one snapshot file each
__snapshots__/  golden snapshots, each frame = { code, release, raw, steps[] }
```

Each step mirrors the backend's `RemapStep`: `kind` / `filename` / `lineno` /
`colno` / `function_name` / `context_line` / `pre_context` / `post_context`.
Main-thread frames are engine-independent (PrimJS bytecode) but kept in
all three files so each covers the page in button order.

`@rstest/core` is taken from the workspace (hoisted, not declared); `source-map`
is a devDependency.

## Usage (from this example's dir)

```bash
pnpm test:build    # DEBUG build keeps debug-metadata.json (a build intermediate)
pnpm test          # assert the three snapshots
pnpm test:update   # recompute and review diff after a demo/build/reversal change
```

`debug-metadata.json` is a build intermediate (normally cleaned), so build with
DEBUG to keep it: `pnpm test:build` (= `DEBUG='rspeedy,rsbuild' pnpm build`).

## Add a case

1. Add a row in `cases.ts`: background `{ name, kind:'bg', err, find, token }`,
   main-thread `{ name, kind:'main-thread', marker }`. `name` = the button text;
   `find` = a substring unique in the generated bundle containing `token`;
   `token` = the failing identifier; `err` = `call` / `read` / `global`.
2. `pnpm test:build && pnpm test:update` to generate snapshots.
3. On a device, tap the button and check the reported `colno` against the
   matching engine snapshot's `raw`, and the reversal against `steps`.
