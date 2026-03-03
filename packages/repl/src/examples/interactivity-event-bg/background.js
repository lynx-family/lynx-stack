/* eslint-disable headers/header-format, no-undef, no-unused-vars, unicorn/consistent-function-scoping */
// The background thread handles events dispatched by string handlers.
//
// When __AddEvent uses a string like "onIncrement", the runtime sends
// a publishEvent RPC to the background thread. We register event
// handler routers on the tt object so the RPC gets connected.
//
// Timing: user code runs during requireModule, BEFORE lynx-core calls
// nativeApp.setCard(tt). So we wrap setCard to register our handlers
// at the right time — when tt and its lazy property descriptors are ready.

const nativeApp = lynx.getNativeApp();
const _setCard = nativeApp.setCard;

nativeApp.setCard = function(tt) {
  // Let the runtime finish its setup first (registers lazy RPC handlers)
  _setCard(tt);

  // Now register our event routers — setting these triggers the lazy
  // property descriptors that connect the RPC endpoints to our functions.
  function routeEvent(handlerName, event) {
    if (typeof globalThis[handlerName] === 'function') {
      globalThis[handlerName](event);
    }
  }

  tt.publishEvent = function(handlerName, event) {
    routeEvent(handlerName, event);
  };

  tt.publicComponentEvent = function(_componentId, handlerName, event) {
    routeEvent(handlerName, event);
  };
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
