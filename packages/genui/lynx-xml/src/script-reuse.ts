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
- ctx.page and ctx.pageId are available inside hooks. ${
    template
      ? 'ctx.nodes is the template id-to-node map, already created before render; never call createFragment or recreate the initial tree.'
      : 'Create the business tree in render using Element PAPI and append it to ctx.page. ctx.nodes starts as an empty map for your own references.'
  }
- ctx.on(node, eventName, handler, options = {}) binds a node event, flushes after its synchronous handler, and returns an unsubscribe function. Use it for all UI listeners; call unsubscribe before discarding dynamic nodes.
- ctx.listen(context, eventName, handler) binds app/background events with automatic flushing and returns unsubscribe. Reuse the correct Lynx context. Destroy removes registered listeners. Background code still owns its cleanup; forward its destroy event from your destroy hook when needed.
- ctx.setText(textNode, value) replaces text children with String(value). It does not flush. Render relies on the SDK initial flush; update, on, and listen flush automatically. For other mutation paths call __FlushElementTree().
- Hooks and helpers run only on the main thread. Declare business-specific state/handlers only; keep optional background logic in its normal source block.`;
}

/** Generate a hoisted helper with all mutable state scoped to one page instance. */
export function generateSharedScript(template: boolean): string {
  return `
function definePage(hooks) {
  const engine = lynx.getEngine();
  let rendered = false;
  let destroyed = false;
  const disposers = [];
  const ctx = {
    page: undefined,
    pageId: undefined,
    nodes: Object.create(null),
    setText(node, value) {
      __ReplaceElements(node, [__CreateRawText(String(value))], __GetChildren(node));
    },
    on(node, name, handler, options = {}) {
      if (destroyed) return () => {};
      function wrapped(event) {
        if (destroyed) return;
        handler(event);
        if (!destroyed) __FlushElementTree();
      }
      __AddEventListener(node, name, wrapped, options);
      return track(() => __RemoveEventListener(node, name, wrapped, options));
    },
    listen(context, name, handler) {
      if (destroyed) return () => {};
      function wrapped(event) {
        if (!rendered || destroyed) return;
        handler(event);
        if (!destroyed) __FlushElementTree();
      }
      context.addEventListener(name, wrapped);
      return track(() => context.removeEventListener(name, wrapped));
    }
  };
  function track(remove) {
    function dispose() {
      const index = disposers.indexOf(dispose);
      if (index < 0) return;
      disposers.splice(index, 1);
      remove();
    }
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
