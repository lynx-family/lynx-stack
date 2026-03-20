// Mock MTC runtime for testing
// In production, this would be the built IIFE from @lynx-js/react-mtc-runtime
(function() {
  'use strict';
  if (globalThis.__mtc_runtime_init__ === undefined) {
    globalThis.__mtc_runtime_init__ = true;
    globalThis.registerMTC = function(hash, factory) {};
  }
})();
