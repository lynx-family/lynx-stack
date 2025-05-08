import { define } from '../util.js';

function installOwnProperties(globalThis: any) {
  define(globalThis, {
    get globalThis() {
      return globalThis._globalProxy;
    },
  });
}

export const createGlobalThis = (): LynxGlobalThis => {
  // @ts-ignore
  const globalThis: LynxGlobalThis = {};

  globalThis._globalObject = globalThis._globalProxy = globalThis;

  installOwnProperties(globalThis);

  return globalThis;
};

/**
 * The `globalThis` object of Lynx dual thread environment.
 *
 * @public
 */
export interface LynxGlobalThis {
  /**
   * @internal
   */
  _globalObject: any;
  /**
   * @internal
   */
  _globalProxy: any;
  /**
   * The globalThis object.
   */
  globalThis: LynxGlobalThis;
  [key: string]: any;
}
