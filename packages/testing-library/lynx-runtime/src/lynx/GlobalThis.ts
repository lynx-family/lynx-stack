import { define } from '../util';

function installOwnProperties(globalThis: any, options: any) {
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
  globalThis: LynxGlobalThis;
  [key: string]: any;
}
