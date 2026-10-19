// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-nocheck
/* istanbul ignore file -- stringified into the application runtime */

export default function(): void {
  var sequence = 0;
  var session = Date.now().toString(36) + Math.random().toString(36).slice(2);
  var pending;
  var failed = false;
  var applying = false;
  var executionError;
  var expectedHash;

  // Fast Refresh's self-accept handler can consume a factory exception. Record
  // it at execution, before that handler runs, and check it before committing.
  __webpack_require__.i.push(function(options) {
    var factory = options.factory;
    options.factory = function() {
      try {
        return factory.apply(this, arguments);
      } catch (error) {
        if (applying) {
          executionError = error instanceof Error
            ? error
            : new Error(String(error));
        }
        throw error;
      }
    };
  });

  lynx.getCoreContext().addEventListener($EVENT$, function(event) {
    var ack = JSON.parse(event.data);
    if (
      failed || ack.session !== session || !pending
      || pending.sequence !== ack.sequence
    ) return;
    var waiter = pending;
    pending = undefined;
    clearTimeout(waiter.timer);
    if (ack.supported === false) {
      $RuntimeGlobals_lynxHMR$ = undefined;
      waiter.resolve(false);
      return;
    }
    if (ack.ok) {
      expectedHash = ack.hash;
      applying = true;
      waiter.resolve();
    } else {
      waiter.reject(new Error(ack.error));
    }
  });

  $RuntimeGlobals_lynxHMR$ = {
    prepare: function(hash) {
      if (failed) return Promise.reject(new Error('HMR transaction stopped'));
      executionError = undefined;
      return new Promise(function(resolve, reject) {
        var currentSequence = ++sequence;
        pending = {
          sequence: currentSequence,
          resolve: resolve,
          reject: reject,
          timer: setTimeout(function() {
            pending = undefined;
            reject(new Error('Main-thread HMR completion timed out'));
          }, 5000),
        };
        lynx.getNativeApp().callLepusMethod($METHOD$, {
          session: session,
          sequence: currentSequence,
          hash: hash,
        }, function() {});
      });
    },
    finish: function(hash) {
      if (executionError) throw executionError;
      if (hash !== expectedHash) throw new Error('HMR thread hashes differ');
      applying = false;
    },
    stop: function() {
      failed = true;
      applying = false;
      if (pending) clearTimeout(pending.timer);
      pending = undefined;
    },
  };
}
