/* eslint-disable headers/header-format */
import type { ConsoleSource } from './types.js';

export const CHANNEL_PREFIX = 'lynx-repl-console-';

export function getConsoleWrapperCode(
  source: ConsoleSource,
  sessionId: string,
): string {
  return `(function(){
  var _console = typeof console !== 'undefined' ? console : null;
  if (!_console) return;
  var _ch = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      _ch = new BroadcastChannel('${CHANNEL_PREFIX}' + '${sessionId}');
    } catch (_) {
      _ch = null;
    }
  }
  var _orig = {
    log: _console.log,
    warn: _console.warn,
    error: _console.error,
    info: _console.info,
    debug: _console.debug
  };
  function _serialize(a) {
    if (a === undefined) return 'undefined';
    if (a === null) return 'null';
    if (a instanceof Error) return a.stack || a.message || String(a);
    if (typeof a === 'object') {
      try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
    }
    return String(a);
  }
  ['log','warn','error','info','debug'].forEach(function(m) {
    var _original = typeof _orig[m] === 'function' ? _orig[m] : null;
    var _wrapped = function() {
      var args = Array.prototype.slice.call(arguments);
      if (_original) {
        try { _original.apply(_console, args); } catch(_) {}
      }
      try {
        if (!_ch) return;
        if (args.length > 0 && typeof args[0] === 'string' && args[0].indexOf('This is an issue of lynx-core') !== -1) return;
        _ch.postMessage({
          level: m,
          source: '${source}',
          args: args.map(_serialize),
          timestamp: Date.now()
        });
      } catch(e) {}
    };
    try { _console[m] = _wrapped; } catch (_) {}
  });
})();
`;
}
