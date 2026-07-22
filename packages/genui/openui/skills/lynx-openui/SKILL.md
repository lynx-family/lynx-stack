---
name: lynx-openui
description: Generate valid OpenUI Lang v0.5 functional-notation programs for the Lynx OpenUI renderer. Use when Codex must turn a natural-language UI request into raw OpenUI DSL for OpenUiRenderer, including static mobile UI, $state, Query/Mutation tool flows, Action plans, streaming-friendly output, or catalog-constrained revisions. Do not use for JSX, HTML, CSS, A2UI JSON, or implementing new ReactLynx components.
---

# Lynx OpenUI Generator

Generate raw OpenUI Lang v0.5 consumed by
`<OpenUiRenderer response={...}>`. Produce declarative DSL, not application
code.

## Read The References

- Always read [components.md](references/components.md) before generating a
  program. Treat caller-supplied component signatures as authoritative
  extensions or replacements.
- Read [runtime.md](references/runtime.md) when the request involves state,
  tools, live data, mutations, actions, repeated query data, or edits.
- Read [examples.md](references/examples.md) for a non-trivial layout or tool
  workflow. Adapt patterns; do not copy irrelevant content.

## Workflow

1. Identify the requested UI, supplied component catalog, available tool
   schemas, media URLs, and whether the host supports full programs or
   `mergeStatements` patches.
2. Choose the data mode:
   - Use static values for self-contained content and when no tool exists.
   - Use `Query` only for an actual read tool supplied by the caller or host.
   - Use `Mutation` only for an actual write tool and trigger it from an
     explicit `Action`.
3. Select only components and positional arguments allowed by the active
   catalog.
4. Write a streaming-friendly graph. For a complete program, put the root
   first, followed by state, queries or mutations, structural components, and
   leaf content. For an edit-mode patch, return only changed statements.
5. Validate syntax, references, reachability, component names, argument order,
   tool names, and action targets before returning the program.

## Output Contract

- Return only OpenUI Lang. Do not return Markdown, code fences, prose, JSON,
  XML, HTML, JavaScript, TypeScript, JSX, or CSS.
- Put one assignment statement on each line.
- For a complete program, make the first non-empty line `root = Stack(...)`.
- Return a complete program by default. When the caller explicitly says the
  host uses edit mode or `mergeStatements`, return only changed statements and
  include `root` only when the root graph changes.
- If a request needs an unavailable component or capability, render a concise
  explanation with supported OpenUI components instead of inventing syntax.

## Syntax Rules

- Use `identifier = Expression` for ordinary declarations and
  `$identifier = defaultValue` for mutable state.
- Pass component arguments positionally. Never use named arguments such as
  `gap: "m"`.
- Omit optional arguments only from the end. When setting a later argument,
  provide valid values for every earlier position.
- Use double-quoted strings and escape embedded quotes and backslashes.
- Use references or inline components. Prefer references for the root and
  major sections so streaming reveals the structure progressively.
- Ensure every referenced identifier is defined. Ensure every declaration
  other than `root` is reachable from `root`, an expression reachable from
  `root`, or an action reachable from `root`.
- Use only documented operators, built-ins, components, and action steps.

Correct positional layout:

```text
root = Stack([header, content], "column", false, "l", "stretch", "start")
```

Incorrect positional layout:

```text
root = Stack([header, content], "column", "l", "stretch")
```

The incorrect form passes a string into `wrap` and shifts every later prop.

## Data And Interaction Rules

- Do not invent tool names. If no tool schema is supplied, use static data or
  an explanatory supported UI.
- Give every `Query` a representative default result matching the real tool
  shape so the UI renders before the request resolves.
- Keep `Query` and `Mutation` declarations on ordinary identifiers, never
  `$identifiers`.
- Use `@Each` for query-backed repeated UI. Keep its loop-dependent component
  inline inside `@Each`.
- Put write operations on a submit or confirmation `Button`. Do not attach a
  mutation to an input's change action.
- When an input must update a `$variable`, use the same-key `name` pattern in
  [runtime.md](references/runtime.md). Do not invent an event-value variable.
- Execute multi-step actions in deliberate order. Remember that a failed
  mutation stops the remaining steps.
- Use `@ToAssistant` for conversational continuation and `@OpenUrl` only with
  a caller-provided or trustworthy URL.
- Use caller-provided media URLs. Do not fabricate CDN URLs or assume the host
  resolves image-search strings.

## Lynx UI Rules

- Prefer compact, mobile-first layouts with a shallow component tree.
- Use `Stack` or `Column` for ordinary vertical structure, `Row` for small
  horizontal groups, and `List` for grouped or repeated content.
- Prefer explicit `Image` variants so the Lynx renderer has concrete sizing.
- Keep readable text in `Text` or `TextContent`; do not emit raw Lynx elements.
- Use `Tabs` for alternate views and `Modal` for tap-to-open details. Pass a
  modal trigger first and content second; do not also render the trigger as a
  sibling.

## Final Verification

Before returning, verify all of the following:

- A complete program starts with `root = Stack(...)`. An edit-mode patch omits
  `root` unless the root graph changes. The response contains only OpenUI Lang.
- Every component exists in the active catalog and every argument matches its
  positional schema.
- No `Form`, `Input`, `Select`, `SelectItem`, `FormControl`, table, or chart is
  used unless the caller supplied that custom component.
- Every reference resolves and no declaration is orphaned.
- Every `Query` or `Mutation` uses a real supplied tool and is referenced by
  visible UI or a visible action.
- Every `$variable` participates in visible UI, a query argument, or an action.
- Every `@Each` loop variable stays inside its inline template expression.
- No working dynamic list relies on `TemplateChildren` in the built-in Lynx
  renderer.
- If a parser is available, parsing finishes with a root, no validation errors,
  no unresolved references, and no orphaned statements.
