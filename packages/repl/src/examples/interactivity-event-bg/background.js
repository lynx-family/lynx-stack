const nativeApp = lynx.getNativeApp();
console.log('[bg] nativeApp:', nativeApp);
console.log('[bg] nativeApp.tt:', nativeApp.tt);
console.log('[bg] nativeApp.setCard:', typeof nativeApp.setCard);

const _setCard = nativeApp.setCard;

nativeApp.setCard = function(tt) {
  console.log('[bg] setCard called! tt:', tt);
  console.log('[bg] tt.publishEvent before _setCard:', tt.publishEvent);
  console.log(
    '[bg] tt.publicComponentEvent before _setCard:',
    tt.publicComponentEvent,
  );

  _setCard(tt);

  console.log('[bg] tt.publishEvent after _setCard:', tt.publishEvent);
  console.log(
    '[bg] tt.publicComponentEvent after _setCard:',
    tt.publicComponentEvent,
  );

  function routeEvent(handlerName, event) {
    console.log('[bg] routeEvent called:', handlerName, event);
    if (typeof globalThis[handlerName] === 'function') {
      globalThis[handlerName](event);
    } else {
      console.log('[bg] handler not found on globalThis:', handlerName);
    }
  }

  tt.publishEvent = function(handlerName, event) {
    console.log('[bg] tt.publishEvent called:', handlerName);
    routeEvent(handlerName, event);
  };

  tt.publicComponentEvent = function(_componentId, handlerName, event) {
    console.log(
      '[bg] tt.publicComponentEvent called:',
      _componentId,
      handlerName,
    );
    routeEvent(handlerName, event);
  };

  console.log('[bg] handlers registered on tt');
};

console.log('[bg] setCard wrapper installed');

// ── State & handlers ────────────────────────────────────────────────────

let count = 0;

globalThis.onDecrement = function(_event) {
  console.log('[bg] onDecrement called, count:', count - 1);
  count--;
  lynx.getCoreContext().dispatchEvent({
    type: 'counterUpdate',
    data: { count },
  });
};

globalThis.onIncrement = function(_event) {
  console.log('[bg] onIncrement called, count:', count + 1);
  count++;
  lynx.getCoreContext().dispatchEvent({
    type: 'counterUpdate',
    data: { count },
  });
};

console.log('[bg] handler functions defined on globalThis');
