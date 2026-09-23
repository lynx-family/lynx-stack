// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** A compact model-facing contract; runtime implementation never enters the prompt. */
export function scriptReuseInstructions(template: boolean): string {
  return `ScriptReuse is enabled (overrides imported lifecycle and Template script guidance):
- In the main script call definePage({...}) exactly once at top level. Do not declare or shadow definePage, create a Page, call createFragment, or register engine lifecycle listeners yourself.
- The agent supplies page creation, a "genui-page" flex-column layout class, render-once guarding, lifecycle payload normalization, update flushing, and listener cleanup. Do not reproduce that implementation.
- Hooks: render(ctx, data), update(ctx, patch), destroy(ctx), all synchronous and optional${
    template ? '' : ' except render'
  }. Engine data/patch is the first event.data array entry, or {} for malformed payloads. Keep business state in your own script scope; no automatic state merge is performed.
- ${
    template
      ? 'ctx.page is available inside hooks. ctx.nodes is the template id-to-node map, already created before render; never call createFragment or recreate the initial tree.'
      : 'ctx.page and ctx.pageId are available inside hooks. Create the business tree in render using Element PAPI and append it to ctx.page. ctx.nodes starts as an empty map for your own references.'
  }
- ctx.on(node, eventName, handler, options = {}) binds a node event, flushes after its synchronous handler, and returns an unsubscribe function. Use it for all UI listeners; call unsubscribe to stop listening early.
- ctx.listen(eventName, handler) receives main-thread app events through event.data and returns an unsubscribe function. ctx.emit(eventName, data) dispatches them. Destroy removes registered listeners.
- ctx.setText(textNode, value) replaces text children with String(value). UI helpers do not flush individually: render relies on the SDK initial flush, while update, on, and listen flush automatically. Call ctx.flush() only after mutations from another synchronous callback.
- Hooks and helpers run only on the main thread. Declare business-specific state and handlers only.${
    template
      ? `
- Additional UI helpers do not flush: ctx.createView(), ctx.createScrollView(), ctx.createText(value), ctx.createImage(), ctx.append(parent, child), ctx.replaceChildren(parent, children), ctx.setClasses(node, classes), ctx.setAttribute(node, name, value), and ctx.setInlineStyles(node, styles). children must be an array. createText stringifies value. Use classes for static styling and inline styles only for runtime-computed values.
- Use only the ctx UI helpers for later mutations and new nodes; do not call raw Element PAPI. The agent owns the initial tree. ctx.replaceChildren removes listeners from discarded subtrees while preserving listeners on reused nodes. Release retained references after replacement, and use destroy(ctx) to release other business-owned resources.
- Pass runtime names such as "tap" to ctx.on, never markup names such as bindtap or catchtap.`
      : ''
  }`;
}

/** Generate a hoisted helper with all mutable state scoped to one page instance. */
export function generateSharedScript(template: boolean): string {
  return `
function definePage(hooks) {
  const engine = lynx.getEngine();
  let rendered = false;
  let destroyed = false;
  let localContext;
  const disposers = [];
  const ctx = {
    page: undefined,
    pageId: undefined,
    nodes: Object.create(null),
    createView() {
      return __CreateView(ctx.pageId);
    },
    createScrollView() {
      return __CreateScrollView(ctx.pageId);
    },
    createText(value) {
      const node = __CreateText(ctx.pageId);
      __AppendElement(node, __CreateRawText(String(value)));
      return node;
    },
    createImage() {
      return __CreateImage(ctx.pageId);
    },
    append(parent, child) {
      __AppendElement(parent, child);
    },
    replaceChildren(parent, children) {
      const previous = __GetChildren(parent);
      disposeRemovedListeners(previous, children);
      __ReplaceElements(parent, children, previous);
    },
    setText(node, value) {
      __ReplaceElements(node, [__CreateRawText(String(value))], __GetChildren(node));
    },
    setClasses(node, classes) {
      __SetClasses(node, classes);
    },
    setAttribute(node, name, value) {
      __SetAttribute(node, name, value);
    },
    setInlineStyles(node, styles) {
      __SetInlineStyles(node, styles);
    },
    flush() {
      if (!destroyed) __FlushElementTree();
    },
    emit(name, data) {
      if (!destroyed) getLocalContext().dispatchEvent({ type: name, data });
    },
    on(node, name, handler, options = {}) {
      if (destroyed) return () => {};
      function wrapped(event) {
        if (destroyed) return;
        handler(event);
        if (!destroyed) __FlushElementTree();
      }
      __AddEventListener(node, name, wrapped, options);
      return track(
        () => __RemoveEventListener(node, name, wrapped, options),
        node
      );
    },
    listen(contextOrName, nameOrHandler, optionalHandler) {
      if (destroyed) return () => {};
      const usesLocalContext = typeof contextOrName === "string";
      const context = usesLocalContext ? getLocalContext() : contextOrName;
      const name = usesLocalContext ? contextOrName : nameOrHandler;
      const handler = usesLocalContext ? nameOrHandler : optionalHandler;
      function wrapped(event) {
        if (!rendered || destroyed) return;
        handler(event);
        if (!destroyed) __FlushElementTree();
      }
      context.addEventListener(name, wrapped);
      return track(() => context.removeEventListener(name, wrapped));
    }
  };
  function getLocalContext() {
    if (!localContext) localContext = lynx.getCoreContext();
    return localContext;
  }
  function containsNode(roots, target) {
    for (const root of roots) {
      if (__ElementIsEqual(root, target)) return true;
      const children = __GetChildren(root);
      if (children && containsNode(children, target)) return true;
    }
    return false;
  }
  function disposeRemovedListeners(previous, next) {
    for (let index = disposers.length - 1; index >= 0; index -= 1) {
      const dispose = disposers[index];
      if (
        dispose.node
        && containsNode(previous, dispose.node)
        && !containsNode(next, dispose.node)
      ) {
        dispose();
      }
    }
  }
  function track(remove, node) {
    function dispose() {
      const index = disposers.indexOf(dispose);
      if (index < 0) return;
      disposers.splice(index, 1);
      remove();
    }
    dispose.node = node;
    disposers.push(dispose);
    return dispose;
  }
  function data(event) {
    const value = event && Array.isArray(event.data) ? event.data[0] : undefined;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }
  function render(event) {
    if (rendered || destroyed) return;
    rendered = true;
    ctx.page = __CreatePage("0", 0);
    ctx.pageId = __GetElementUniqueID(ctx.page);
    __SetClasses(ctx.page, "genui-page");
    ${template ? 'ctx.nodes = createFragment(ctx.page, ctx.pageId);' : ''}
    if (hooks.render) hooks.render(ctx, data(event));
  }
  function update(event) {
    if (!rendered || destroyed) return;
    if (hooks.update) hooks.update(ctx, data(event));
    if (!destroyed) __FlushElementTree();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try {
      if (hooks.destroy) hooks.destroy(ctx);
    } finally {
      engine.removeEventListener("__RenderPage", render);
      engine.removeEventListener("__UpdatePage", update);
      engine.removeEventListener("__DestroyLifetime", destroy);
      try {
        while (disposers.length) disposers[disposers.length - 1]();
      } finally {
        ctx.nodes = Object.create(null);
        ctx.page = undefined;
        ctx.pageId = undefined;
        localContext = undefined;
        hooks = {};
      }
    }
  }
  engine.addEventListener("__RenderPage", render);
  engine.addEventListener("__UpdatePage", update);
  engine.addEventListener("__DestroyLifetime", destroy);
}
`;
}
