// The background thread handles events dispatched by string handlers.
//
// When __AddEvent uses a string like "onIncrement", the runtime sends
// a publishEvent RPC to the background thread. We register event
// handler routers on lynxCoreInject.tt — the same object @lynx-js/react uses.
//
// lynxCoreInject.tt is available during module initialization, unlike
// nativeApp.tt which is set later by setCard().

// Route events from the runtime to named handler functions on globalThis.
function routeEvent(handlerName, event) {
  if (typeof globalThis[handlerName] === 'function') {
    globalThis[handlerName](event);
  }
}

lynxCoreInject.tt.publishEvent = function(handlerName, event) {
  routeEvent(handlerName, event);
};

lynxCoreInject.tt.publicComponentEvent = function(
  _componentId,
  handlerName,
  event,
) {
  routeEvent(handlerName, event);
};

// ── State & handlers ────────────────────────────────────────────────────

let count = 0;

globalThis.onDecrement = function(_event) {
  count--;
  lynx.getCoreContext().dispatchEvent({
    type: 'counterUpdate',
    data: { count },
  });
};

globalThis.onIncrement = function(_event) {
  count++;
  lynx.getCoreContext().dispatchEvent({
    type: 'counterUpdate',
    data: { count },
  });
};
