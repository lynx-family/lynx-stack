import { define } from '../util';

function installOwnProperties(globalThis: any, options: any) {
  globalThis._virtualConsole = options.virtualConsole;

  // ### PUBLIC DATA PROPERTIES (TODO: should be getters)

  function wrapConsoleMethod(method: any) {
    return (...args: any[]) => {
      globalThis._virtualConsole.emit(method, ...args);
    };
  }

  globalThis.console = {
    assert: wrapConsoleMethod('assert'),
    clear: wrapConsoleMethod('clear'),
    count: wrapConsoleMethod('count'),
    countReset: wrapConsoleMethod('countReset'),
    debug: wrapConsoleMethod('debug'),
    dir: wrapConsoleMethod('dir'),
    dirxml: wrapConsoleMethod('dirxml'),
    error: wrapConsoleMethod('error'),
    group: wrapConsoleMethod('group'),
    groupCollapsed: wrapConsoleMethod('groupCollapsed'),
    groupEnd: wrapConsoleMethod('groupEnd'),
    info: wrapConsoleMethod('info'),
    log: wrapConsoleMethod('log'),
    table: wrapConsoleMethod('table'),
    time: wrapConsoleMethod('time'),
    timeLog: wrapConsoleMethod('timeLog'),
    timeEnd: wrapConsoleMethod('timeEnd'),
    trace: wrapConsoleMethod('trace'),
    warn: wrapConsoleMethod('warn'),
  };

  define(globalThis, {
    get globalThis() {
      return globalThis._globalProxy;
    },
  });
}

export const createGlobalThis = (options: any): LynxGlobalThis => {
  // @ts-ignore
  const globalThis: LynxGlobalThis = {};

  globalThis._globalObject = globalThis._globalProxy = globalThis;

  installOwnProperties(globalThis, options);

  return globalThis;
};

export interface LynxGlobalThis {
  _globalObject: any;
  _globalProxy: any;
  _virtualConsole: any;
  globalThis: LynxGlobalThis;
  [key: string]: any;
}
