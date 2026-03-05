# Bringing Vue 3 to Lynx: A TodoMVC Experiment

_How we ported the classic TodoMVC app to run on Lynx's native rendering engine using Vue 3's official Custom Renderer API — reusing >95% of Vue with ~500 lines of adapter code._

## The Premise

[Lynx](https://lynxjs.org) is a cross-platform native UI framework with a dual-thread architecture: a **Background Thread** runs JavaScript business logic, while a **Main Thread** executes native rendering via a C++ layout engine. Communication between them happens through a serialized operation buffer.

Vue 3, since its ground-up rewrite, ships a first-class [`createRenderer()`](https://vuejs.org/api/custom-renderer.html) API that decouples its reactivity and component systems from any specific rendering target. Projects like `vue-three` (Three.js) and `vue-native` have used this to bring Vue to non-DOM environments.

We asked: **Can we bring Vue 3 to Lynx with minimal custom code, while keeping the developer experience identical to writing a normal Vue app?**

The answer is yes. And to prove it, we ported [TodoMVC](https://github.com/tastejs/todomvc/tree/gh-pages/examples/vue).

## Architecture: Two Threads, One Ops Buffer

```
┌─────────────────────────────┐     callLepusMethod('vuePatchUpdate')     ┌───────────────────────────┐
│     Background Thread       │ ──────────────────────────────────────▶  │      Main Thread          │
│                             │                                          │                           │
│  Vue 3 Runtime              │     JSON.stringify(ops)                   │  Ops Executor             │
│  ┌───────────────────────┐  │                                          │  ┌─────────────────────┐  │
│  │ @vue/runtime-core     │  │                                          │  │ applyOps(ops)       │  │
│  │ (ref, computed, v-if, │  │                                          │  │ __CreateElement()   │  │
│  │  v-for, :class, ...)  │  │                                          │  │ __AppendElement()   │  │
│  └──────────┬────────────┘  │     publishEvent(sign, data)             │  │ __SetClasses()      │  │
│             │               │ ◀──────────────────────────────────────  │  │ __SetInlineStyles() │  │
│  ┌──────────▼────────────┐  │                                          │  │ __FlushElementTree()│  │
│  │ Custom nodeOps        │  │                                          │  └─────────────────────┘  │
│  │ ShadowElement tree    │  │                                          │                           │
│  │ Ops buffer            │  │                                          │  Native Layout Engine     │
│  │ Event registry        │  │                                          │  (C++ Flexbox/Linear)     │
│  └───────────────────────┘  │                                          │                           │
└─────────────────────────────┘                                          └───────────────────────────┘
```

### Background Thread (the Vue side)

Vue's renderer calls synchronous methods like `createElement()`, `insert()`, `patchProp()`, and `parentNode()`. Since cross-thread calls are async, we can't call the Main Thread directly. Instead:

1. **ShadowElement tree** — A lightweight doubly-linked tree (~100 LOC) that lives entirely in the Background Thread. It satisfies Vue's synchronous `parentNode()` and `nextSibling()` queries without cross-thread overhead.

2. **Ops buffer** — Every renderer operation (`CREATE`, `INSERT`, `SET_CLASS`, `SET_STYLE`, `SET_EVENT`, ...) appends to a flat array. After Vue's scheduler finishes a tick, we flush the entire buffer to the Main Thread in one `callLepusMethod` call.

3. **Event registry** — When a `@tap` handler is bound, we generate a unique sign string (`"vue:0"`, `"vue:1"`, ...), send it to the Main Thread via `SET_EVENT`, and store the handler closure in a Map. When the native layer fires the event, it calls `publishEvent(sign, data)` on the Background Thread, and we look up and invoke the handler directly — no round-trip.

### Main Thread (the PAPI side)

The Main Thread is deliberately simple: a switch-loop (~170 LOC) that reads the ops array and calls Lynx's **PAPI** (Platform API) functions:

```
CREATE  → __CreateElement(tag, 0) + __SetCSSId([el], 0)
INSERT  → __AppendElement(parent, child)
SET_CLASS → __SetClasses(el, "todo-item completed")
SET_STYLE → __SetInlineStyles(el, { color: "#4d4d4d" })
SET_EVENT → __AddEvent(el, "bindEvent", "tap", "vue:3")
...
__FlushElementTree()  // commit all changes to native layout
```

## The TodoMVC Port

### What the code looks like

Here's the TodoHeader component — the input field where you type new todos:

```vue
<!-- Lynx version -->
<script setup>
const emit = defineEmits(['add-todo']);

function onConfirm(e) {
  const value = e?.detail?.value ?? '';
  if (value.trim()) {
    emit('add-todo', value);
  }
}
</script>

<template>
  <view class="header">
    <text class="title">todos</text>
    <input
      class="new-todo"
      type="text"
      placeholder="What needs to be done?"
      @confirm="onConfirm"
    />
  </view>
</template>
```

Compare with the original web version:

```vue
<!-- Web version -->
<template>
  <header class="header">
    <RouterLink to="/"><h1>todos</h1></RouterLink>
    <input
      type="text"
      class="new-todo"
      placeholder="What needs to be done?"
      @keyup.enter="
        $emit('add-todo', $event.target.value);
        $event.target.value = '';
      "
    />
  </header>
</template>
```

The `<script setup>` logic is nearly identical. The template differences are:

- `<header>` → `<view>`, `<h1>` → `<text>` (Lynx elements)
- `@keyup.enter` → `@confirm` (Lynx input event)
- No `<RouterLink>` (we use reactive state instead of URL routing)

### What changed, what didn't

```
┌─────────────────┬─────────────────────────────────────────┬──────────────────────────┬────────────────────────────────────────────┐
│     Aspect      │             Original (Web)              │        Lynx Port         │                   Delta                    │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ Components      │ 4 SFCs + 1 entry                        │ 4 SFCs + 1 entry         │ Same                                       │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ Vue Router      │ Required (3 routes)                     │ Not needed               │ Replaced with ref('all')                   │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ Business logic  │ Composition API                         │ Composition API          │ Zero changes (ref/computed/emit identical) │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ Template syntax │ v-if/v-for/:class/v-show                │ Same                     │ Zero changes                               │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ HTML tags       │ div/li/button/label…                    │ view/text                │ Mechanical swap                            │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ Events          │ @click/@dblclick/@keyup.enter           │ @tap/@longpress/@confirm │ Name swap                                  │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ Checkbox        │ <input type="checkbox">                 │ <view> + @tap            │ Rewrite (no checkbox in Lynx)              │
├─────────────────┼─────────────────────────────────────────┼──────────────────────────┼────────────────────────────────────────────┤
│ CSS             │ todomvc-app-css (heavy pseudo-elements) │ Custom todomvc.css       │ Rewrite (no ::before/:hover)               │
└─────────────────┴─────────────────────────────────────────┴──────────────────────────┴────────────────────────────────────────────┘
```

**In one line: Business logic and Vue patterns are untouched. Only tag names, event names, and CSS need adaptation.**

### The CSS story

Lynx supports CSS class selectors (`.todoapp`, `.todo-item.completed .todo-label`), flexbox, borders, `text-decoration: line-through`, `box-shadow`, CSS variables, and more. But it does NOT support:

- Pseudo-elements (`::before`, `::after`) — the original TodoMVC uses these heavily for checkbox circles and the destroy "×" button
- `:hover`, `:focus` pseudo-classes
- `!important`
- Attribute selectors (so Vue's `<style scoped>` won't work)

We wrote a Lynx-compatible `todomvc.css` (~180 lines) that achieves a similar look using real elements instead of pseudo-elements, and `@tap` `:active` states instead of `:hover`.

#### The `__SetCSSId` discovery

CSS selectors compiled correctly into the Lynx bundle but **didn't apply** to any elements. After extensive debugging, we discovered the root cause: Lynx's CSS selector engine requires every element to be associated with a CSS scope via `__SetCSSId(elements, cssId)`.

In React Lynx, this happens automatically during snapshot template instantiation. In our dynamic PAPI approach (where elements are created at runtime via `__CreateElement()`), we needed to explicitly call:

```typescript
case OP.CREATE: {
  const el = __CreateElement(type, 0);
  __SetCSSId([el], 0);  // Associate with CSS scope 0 (global styles)
  // ...
}
```

This one line unlocked the entire CSS selector system for dynamically-created elements — a pattern that wasn't documented anywhere and required tracing through React Lynx's snapshot code to find.

We also enabled `enableCSSInvalidation: true` in the template plugin, which is required for Vue's dynamic `:class` bindings to trigger CSS recalculation when classes change reactively.

#### The `hoistStatic` trap

Vue's template compiler (`@vue/compiler-dom`) has a `stringifyStatic` optimisation: when it detects 5 or more consecutive sibling elements whose props are all constant, it serialises them into a single HTML string and creates a `Static` VNode. At runtime, the renderer mounts this VNode by calling `insertStaticContent(htmlString, container, anchor)`, which in `@vue/runtime-dom` uses `innerHTML` to parse and insert the nodes in one shot.

Our ShadowElement custom renderer doesn't implement `insertStaticContent` — it would need a full HTML parser to convert DOM markup back into ShadowElements and ops. The issue was invisible during the TodoMVC port because every template element carried dynamic bindings (`:class`, `v-if`, `@tap`), keeping the sibling count below the threshold. It surfaced later in a scroll-tracking demo with 6 consecutive `<view>` elements that differed only in constant `:style` objects:

```vue
<scroll-view ...>
  <view :style="{ height: 300, backgroundColor: '#16213e' }">...</view>
  <view :style="{ height: 250, backgroundColor: '#0f3460' }" />
  <view :style="{ height: 300, backgroundColor: '#533483' }" />
  <view :style="{ height: 250, backgroundColor: '#0f3460' }" />
  <view :style="{ height: 300, backgroundColor: '#16213e' }" />
  <view :style="{ height: 400, backgroundColor: '#533483' }" />
</scroll-view>
```

The compiler detected all six as "constant-prop-only" nodes, stringified them, and at runtime the renderer crashed: `TypeError: hostInsertStaticContent is not a function`.

The fix: set `hoistStatic: false` in the Vue compiler options. This is the standard approach for non-DOM custom renderers (vue-three, vue-native, etc.) — it disables both prop hoisting and `stringifyStatic`, ensuring the compiler never generates `Static` VNodes that require HTML parsing. The performance cost is negligible: Vue's VNode diffing still skips static subtrees via the Block Tree optimisation, which operates at the VDOM level independently of `hoistStatic`.

```ts
// in pluginVueLynx → pluginVue compilerOptions
compilerOptions: {
  isNativeTag: () => true,
  hoistStatic: false,  // no insertStaticContent in custom renderer
}
```

## How much of Vue do we reuse?

```
┌───────────────────┬─────────────────────────────────────────┬─────────────────────┐
│       Layer       │                 Source                  │        Reuse        │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ Reactivity        │ @vue/reactivity                         │ 100% official       │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ Component system  │ @vue/runtime-core                       │ 100% official       │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ Template compiler │ @vue/compiler-dom + @rsbuild/plugin-vue │ 100% official       │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ Renderer          │ Custom createRenderer(nodeOps)          │ Custom (~200 LOC)   │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ v-show            │ Custom (ops-based display:none)         │ Custom (~15 LOC)    │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ v-model           │ Stubbed                                 │ Not yet implemented │
├───────────────────┼─────────────────────────────────────────┼─────────────────────┤
│ Cross-thread comm │ ops buffer + callLepusMethod            │ Custom (~250 LOC)   │
└───────────────────┴─────────────────────────────────────────┴─────────────────────┘
```

**Reuse rate > 95%.** Total custom code: ~500 lines of runtime + ~300 lines of build plugin.

Everything else — the entire reactivity system, component model, template compiler, scheduler, and all Composition API utilities — is official, unmodified Vue 3.

## The build pipeline

The `@lynx-js/vue-rsbuild-plugin` handles the dual-thread split:

```
User entry (index.ts + App.vue)
  │
  ├─── Background bundle ──▶ Vue runtime + user components + entry-background.ts
  │                           (wrapped in AMD by RuntimeWrapperWebpackPlugin)
  │
  └─── Main Thread bundle ─▶ entry-main.ts (PAPI bootstrap, ~60 lines)
                              (flat ESM, compiled to Lepus bytecode)

  Both ──▶ LynxTemplatePlugin ──▶ .lynx.bundle (single binary)
```

From the developer's perspective, it's just:

```ts
// lynx.config.ts
import { pluginVueLynx } from '@lynx-js/vue-rsbuild-plugin';

export default defineConfig({
  source: { entry: { todomvc: './src/todomvc/index.ts' } },
  plugins: [pluginVueLynx({ enableCSSSelector: true })],
});
```

## What's next

This is an early-stage experiment. Open areas include:

- **`v-model` on `<input>`** — Currently stubbed. Lynx inputs use `bindinput`/`bindconfirm` events with `getValue()`/`setValue()` methods rather than DOM value properties.
- **`<style scoped>`** — Vue's scoping uses attribute selectors (`[data-v-xxx]`) which Lynx doesn't support. Possible solutions: CSS Modules, or a custom scoping transform using class prefixes.
- **List recycling** — Lynx has a native `<list>` component with cell recycling (like `RecyclerView`). Integrating this with `v-for` would be a major performance win for long lists.
- **Snapshot compilation** — The current approach creates all elements dynamically via PAPI. A compile-time approach (like React Lynx's snapshot system) could eliminate the first-paint latency by pre-building the element tree into the template binary.
- **Vue DevTools** — Connecting Vue's devtools to the Background Thread for component inspection.

## Conclusion

Vue 3's Custom Renderer API makes it remarkably straightforward to target a non-DOM rendering engine. The core insight is that Vue's value proposition — reactivity, component composition, template syntax — is entirely independent of the rendering target. By implementing ~500 lines of adapter code and a build plugin, we get the full Vue developer experience on a native rendering engine.

The TodoMVC port demonstrates that real-world Vue applications can run on Lynx with minimal source changes: business logic stays identical, and the adaptation surface is limited to element names, event names, and CSS constraints. For teams already invested in Vue, this opens a path to native performance without a framework rewrite.

---

_Built with Vue 3.5, Lynx 3.2, and rspeedy. Source code in `packages/vue/` of the lynx-stack monorepo._
