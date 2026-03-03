// The background thread receives events with element identity info.
//
// It cannot touch elements directly, but it can read:
//   event.currentTarget.id       → string ID from __SetID
//   event.currentTarget.dataset  → data attributes from __SetDataset
//
// It uses this to maintain state and send instructions to the main thread.

// Register event routers on lynxCoreInject.tt (available during module init).
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

let selectedId = null;

globalThis.onCardTap = function(event) {
  // event.target       → the actual DOM element tapped (could be a child)
  // event.currentTarget → the element the handler is bound to (the card)
  //
  // Use currentTarget to reliably read the card's ID and dataset,
  // since target might be a child element (e.g. the text label).
  const targetId = event.currentTarget.id;
  const label = event.currentTarget.dataset?.label || targetId;

  // biome-ignore lint/suspicious/noConsoleLog: intentional debug output in example
  console.log(
    'Background received tap — id:',
    targetId,
    'dataset:',
    event.currentTarget.dataset,
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
