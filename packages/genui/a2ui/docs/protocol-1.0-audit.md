# A2UI 1.0 migration audit

English | [简体中文](./protocol-1.0-audit_zh.md)

This audit compares the six migration commits from `c118dd9fd` through
`9f8404e0a`, including their tests, generated catalogs, prompts, examples,
transport adapters, and documentation, with the official specification at
[`24d1bf9c830071f74c9c908433e73cc6cbe0aa33`](https://github.com/a2ui-project/a2ui/tree/24d1bf9c830071f74c9c908433e73cc6cbe0aa33).
The upstream [version registry](https://github.com/a2ui-project/a2ui/blob/24d1bf9c830071f74c9c908433e73cc6cbe0aa33/specification/versions.json)
marks 1.0 as current. The previous branch pinned `1c45c809b655878d06e3afc6dda22100afecc0a4`.

## Changes from the previous branch contract

| Area                    | Previous branch                                        | Current contract and implementation                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wire version            | `"v1.0"`                                               | `"1.0"` in both directions, metadata, examples, and prompts. Old and missing versions are rejected.                                                                                                           |
| Dynamic values          | `path`, `call`                                         | `@path`, `@call`. Plain keys remain literal data. `@@` escapes one leading `@`; unknown directives fail.                                                                                                      |
| Component envelope      | `catalogId`, `metadata`, `accessibility`, `checks`     | `@catalogId`, `@metadata`, `@accessibility`, `@checks`. Surface and function `catalogId`, ChildList `path`, and updateDataModel `path` remain bare.                                                           |
| Renderer RPC            | No data-model scope                                    | Optional `surfaceId`; omitted scope is an isolated empty model. Invalid scope or permissions produces a correlated `rendererFunctionResponse`.                                                                |
| Function execution      | Incomplete permission and schema handling              | Enforce `allowedCallers`, `requiresUserActivation`, resolved argument validation, and defaults. Schema-only functions can route to the Agent. Actions await nested asynchronous results and make fresh calls. |
| Failures                | Some failures silently became `undefined` or timed out | Dynamic failures become `null`; routed errors identify `functionCallId`, local errors identify `surfaceId`. Transport rejection ends pending RPCs.                                                            |
| Validation              | Mixed Boolean and ValidationResult behavior            | Apply explicit DynamicBoolean coercion. Preserve optional CheckRule.message, result message precedence, code, and severity.                                                                                   |
| Interpolation and regex | Older Web function dependency                          | Local implementations; interpolation inherits the enclosing function catalog and resolves `@index`. Regex uses the portable dialect, static safety analysis, Unicode code points, and absolute end anchors.   |
| Catalogs                | Older function/envelope schemas                        | Current discriminators and relative common-type references. Preserve user activation declarations; reject the reserved Surface component name; enforce composition constraints.                               |
| Snapshots               | Serialized renderer clone contexts                     | Preserve wire templates and metadata. Internal clone IDs and data contexts are not serialized as component props.                                                                                             |
| Playground              | Click-only transport                                   | Forward protocol messages and renderer data-model metadata. Validate all local and gallery messages against pinned schemas and the generated Lynx catalog.                                                    |

## Walkthrough by implementation area

- `src/store`: lifecycle, JSON subtree updates, catalog lookup, expressions,
  template expansion, RPC correlation, asynchronous values, and composition
  constraints. Internal `beginRendering`/`surfaceUpdate` resource names are not
  accepted wire operations and do not provide 0.9 compatibility.
- `src/react` and `src/catalog`: actions, validation, qualified components,
  accessibility attributes, and catalog serialization. Checks and actions remain
  unevaluated until their own execution boundary. The old Modal field aliases
  and wrapped template-child fallback were removed.
- `src/functions`: 14 official basic functions plus 11 explicitly declared Lynx
  utilities. The utilities are custom catalog entries, not support for an old
  protocol. The 0.9 Web SDK dependency was removed. Function schemas and regex
  analysis are pinned to the same upstream revision as the protocol fixtures.
- `src/snapshot`: retain typed data, deletion semantics, reachable component
  definitions, collection templates, and surface extension metadata.
- `a2ui-catalog-extractor`: emit component/function discriminators, reference
  types, and catalog union definitions; update schema fixtures and documentation.
- `server/agent/a2ui`: current prompts, messages, catalog data, common types,
  source guards, streaming validation, and composition checks. Strict envelope
  parsing rejects removed fields such as protocol-level theme.
- `server/app/a2ui`: validate renderer envelopes independently of HTTP options;
  preserve JSON/SSE RPC responses and action metadata. The stateless service
  acknowledges surface-independent renderer feedback without inventing a surface.
- `playground`, CLI templates, and examples: current wire keys and catalog IDs,
  valid component identifiers, visible protocol failures, and RPC forwarding.
  Gallery media examples use supported link actions instead of advertising
  unavailable AudioPlayer/Video renderers.
- Bench adapters and runner: protocol version, message extraction, source guards,
  and replay fixtures use the same contract; evaluation behavior is unchanged.

## Scope and host responsibilities

The published catalog is the **Lynx catalog**, not an assertion that every component
in the official basic catalog has a native implementation. Agent functions are
not installed in the GenUI service; unsupported calls return `UNKNOWN_FUNCTION`.
Hosts can register trusted implementations. No remote code or catalog references
are fetched by the client expression evaluator.

Accessibility label/description and hidden state map to Lynx attributes; Web
attributes also carry live-region intent. Actual screen-reader behavior depends
on the host platform. `openUrl` needs a browser or a host-provided native
implementation. Native bytecode compilation is checked; it does not replace
physical-device accessibility testing.

The regression suite uses pinned upstream schemas, local mocks, and generated
catalogs. It does not rely on live model output or claim certification against an
external conformance program.

## Verification

- Full repository build: 75 tasks passed, including native bytecode and Web.
- Related regressions: 114 files, 1,028 tests passed, including all 8 Local
  Examples and 35 Gallery examples against the pinned schemas.
- Client, server, and extractor type checks passed; API Extractor passed all 26 tasks.
- Changed-file ESLint, Biome, dprint, and `git diff --check` passed. Changeset
  status reports the intended GenUI minor release with a documented breaking change.
- The unfiltered repository Biome command also scans ignored build outputs under
  `examples/react-debug-metadata/dist-consumer`, reporting generated-code errors.
  The scoped source check passes; no generated output is included in the change.
- Playground's standalone `tsc --noEmit` command is blocked by its existing project
  reference configuration (TS6310). Its Web and native production builds pass.
