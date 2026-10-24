# @lynx-js/skill-lynx-openui

## 0.0.3

### Patch Changes

- Add the immutable `@Append(array, item)` OpenUI builtin, shared by the renderer and prompt library. Use it for Todo additions without a fixed list capacity and document data operations, nested-array semantics, and concurrency limits. ([#4173](https://github.com/lynx-family/lynx-stack/pull/4173))

- Add a built-in Web Canvas component to OpenUI with incremental drawing from streamed code chunks, reactive redraws, and click actions that expose logical canvas coordinates through state bindings. ([#4188](https://github.com/lynx-family/lynx-stack/pull/4188))

- Add shared closed enum guidance to full and reduced OpenUI generation prompts and skill references. Require exact argument values and avoid borrowing values from other components or upstream libraries. ([#4133](https://github.com/lynx-family/lynx-stack/pull/4133))

- Guide generation to keep mutable ([#4168](https://github.com/lynx-family/lynx-stack/pull/4168))
  business content in Query results and update it through Mutation and Query
  refresh. Include the local data tool contract in the shared default OpenUI prompt
  only when the host declares both local data tools and tool calls are enabled. Execute preview mutations deterministically in local storage without
  model requests. Keep conversation history and shares as plain DSL with Query defaults. Restore
  saved local data only through the host renderer’s initialQueryResults input.

## 0.0.2

### Patch Changes

- Teach the Lynx OpenUI skill to follow reduced component catalogs and custom ([#3464](https://github.com/lynx-family/lynx-stack/pull/3464))
  root components, and to preserve Query assignment IDs used by prefetched
  initial results.
