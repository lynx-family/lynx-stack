# GenUI for Lynx

Lynx Stack provides four Generative UI integrations: A2UI, OpenUI, ReactLynx, and
Lynx XML. A2UI and OpenUI keep generated output as data and render components
trusted by the Lynx application. Lynx XML generates complete executable page
artifacts using Vanilla Lynx.

## Choose an integration

| Component        | A2UI                                         | OpenUI                                               | ReactLynx                        | Lynx XML                                                     |
| ---------------- | -------------------------------------------- | ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| Output format    | A2UI v0.9 messages                           | OpenUI Lang v0.5 assignments                         | `App.tsx` + `App.css`            | Standalone `.lynxml` artifact                                |
| UI contract      | Catalog                                      | Library                                              | ReactLynx                        | Vanilla Lynx and Element PAPI                                |
| Client input     | Incremental protocol messages                | Accumulated OpenUI text                              | Compiled Web or Native bundle    | Normalized final artifact after any enabled transformation   |
| Primary renderer | `<A2UI>`                                     | `<OpenUiRenderer>`                                   | Lynx host                        | Lynx XML runtime                                             |
| State and data   | Protocol operations and client message store | `$variables`, Query, Mutation, and Action statements | React components and hooks       | Model-authored main-thread JavaScript                        |
| Best fit         | Agents and transports that speak A2UI        | Compact declarative UI text                          | Complete interactive React pages | Complete page artifacts with generated code and interactions |

Choose the integration your Agent and host support. A2UI and OpenUI require
matching component contracts on the prompt and renderer sides. Lynx XML needs
a host that loads `.lynxml` artifacts, with matching prompt and transformation options.
Use one format from generation to rendering for each generated surface.

ReactLynx generates `App.tsx` and `App.css`, compiles Web and Native bundles,
and loads them in a Lynx host. It fits complete interactive pages authored with
React components and hooks. Use `@lynx-js/genui/reactlynx` for the prompt, source
validation, and Node.js compiler; your backend publishes the emitted assets.

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

### ReactLynx

- [Introduction](/guide/genui/reactlynx)
- [Overview and architecture](/guide/genui/reactlynx/overview)
- [Source and builds](/guide/genui/reactlynx/source-guide)
- [System prompts](/guide/genui/reactlynx/system-prompts)

### Lynx XML

- [Introduction](/guide/genui/lynx-xml)
- [Overview and architecture](/guide/genui/lynx-xml/overview)
- [Artifacts and validation](/guide/genui/lynx-xml/artifact-guide)
- [System prompts](/guide/genui/lynx-xml/system-prompts)

## Playground

Use the [GenUI Playground](https://lynx-stack.dev/genui/) to inspect the built-in
A2UI and OpenUI component sets, or generate and preview ReactLynx pages and Lynx XML artifacts.
