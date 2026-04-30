const externalsGlobalSymbol = Symbol.for('__LYNX_EXTERNAL_GLOBAL__');

export function beforeExecute() {
  if (lynx[externalsGlobalSymbol]) {
    delete lynx[externalsGlobalSymbol];
  }
}

export function findBundle() {
  return ['main:main-thread.js', 'main:background.js'];
}
