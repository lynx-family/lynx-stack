# GenUI for Lynx

Lynx Stack provides three Generative UI integrations: A2UI, OpenUI, and
Lynx XML. A2UI and OpenUI keep generated output as data and render components
trusted by the Lynx application. Lynx XML generates complete executable page
artifacts using Vanilla Lynx.

## Choose an integration

| Component        | A2UI                                         | OpenUI                                               | Lynx XML                                                     |
| ---------------- | -------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| Output format    | A2UI v0.9 messages                           | OpenUI Lang v0.5 assignments                         | Standalone `.lynxml` artifact                                |
| UI contract      | Catalog                                      | Library                                              | Vanilla Lynx and Element PAPI                                |
| Client input     | Incremental protocol messages                | Accumulated OpenUI text                              | Normalized final artifact after any enabled transformation   |
| Primary renderer | `<A2UI>`                                     | `<OpenUiRenderer>`                                   | Lynx XML runtime                                             |
| State and data   | Protocol operations and client message store | `$variables`, Query, Mutation, and Action statements | Model-authored main-thread JavaScript                        |
| Best fit         | Agents and transports that speak A2UI        | Compact declarative UI text                          | Complete page artifacts with generated code and interactions |

Choose the integration your Agent and host support. A2UI and OpenUI require
matching component contracts on the prompt and renderer sides. Lynx XML needs
a host that loads `.lynxml` artifacts, with matching prompt and transformation options.
Use one format from generation to rendering for each generated surface.

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

### Lynx XML

- [Introduction](/guide/genui/lynx-xml)
- [Overview and architecture](/guide/genui/lynx-xml/overview)
- [Artifacts and validation](/guide/genui/lynx-xml/artifact-guide)
- [System prompts](/guide/genui/lynx-xml/system-prompts)

## Playground

Use the [GenUI Playground](https://lynx-stack.dev/genui/) to inspect the built-in
A2UI and OpenUI component sets, or generate and preview Lynx XML artifacts.
