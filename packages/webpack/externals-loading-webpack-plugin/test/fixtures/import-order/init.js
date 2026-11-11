globalThis.__externalOrder.ready = true;
globalThis.__externalOrder.events.push('init');
if (globalThis.__externalOrder.inject) {
  lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')].Component =
    globalThis.__externalOrder.inject;
}
