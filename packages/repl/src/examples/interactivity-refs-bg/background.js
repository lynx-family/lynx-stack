/* eslint-disable headers/header-format, no-undef, unicorn/consistent-function-scoping */
// The background thread receives events with element identity info.
//
// It cannot touch elements directly, but it can read:
//   event.target.id       → string ID from __SetID
//   event.target.dataset  → data attributes from __SetDataByKey
//
// It uses this to maintain state and send instructions to the main thread.

const nativeApp = lynx.getNativeApp();
const _setCard = nativeApp.setCard;

nativeApp.setCard = function(tt) {
  _setCard(tt);

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

let selectedId = null;

globalThis.onCardTap = function(event) {
  // The background thread can read element identity from the event:
  //   event.target.id       → the element's ID set via __SetID
  //   event.target.dataset  → data attributes via __SetDataByKey
  const targetId = event.target.id;
  const label = event.target.dataset?.label || targetId;

  // biome-ignore lint/suspicious/noConsoleLog: intentional debug output in example
  console.log(
    'Background received tap — id:',
    targetId,
    'dataset:',
    event.target.dataset,
  );

  // Toggle selection
  selectedId = selectedId === targetId ? null : targetId;

  // Send selection state back to main thread for rendering
  lynx.getCoreContext().dispatchEvent({
    type: 'selectionUpdate',
    data: {
      selectedId,
      label: selectedId ? label : null,
    },
  });
};
