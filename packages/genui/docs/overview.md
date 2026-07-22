# GenUI for Lynx

Lynx Stack provides two declarative Generative UI integrations: A2UI and
OpenUI. Both keep generated output as data and render only components trusted
by the Lynx application, but they use different wire formats and component
contracts.

## Choose a protocol

| Component          | A2UI                                         | OpenUI                                               |
| ------------------ | -------------------------------------------- | ---------------------------------------------------- |
| Protocol           | A2UI v0.9 messages                           | OpenUI Lang v0.5 assignments                         |
| Component contract | Catalog                                      | Library                                              |
| Client input       | Incremental protocol messages                | Accumulated OpenUI text                              |
| Primary renderer   | `<A2UI>`                                     | `<OpenUiRenderer>`                                   |
| State and data     | Protocol operations and client message store | `$variables`, Query, Mutation, and Action statements |
| Best fit           | Agents and transports that speak A2UI        | Agents that generate compact declarative UI text     |

Choose the protocol your Agent and transport already support. The two
renderers can coexist in one application, but a single generated surface must
use one protocol from end to end.

## Documentation

### A2UI

- [Introduction](/guide/genui/a2ui)
- [Overview and architecture](/guide/genui/a2ui/overview)
- [Catalogs and components](/guide/genui/a2ui/catalog-guide)
- [System prompts](/guide/genui/a2ui/system-prompts)

### OpenUI

- [Introduction](/guide/genui/openui)
- [Overview and architecture](/guide/genui/openui/overview)
- [Libraries and components](/guide/genui/openui/library-guide)
- [System prompts](/guide/genui/openui/system-prompts)

## Playground

Use the [GenUI Playground](https://lynx-stack.dev/genui/) to inspect the built-in
A2UI and OpenUI component sets.
