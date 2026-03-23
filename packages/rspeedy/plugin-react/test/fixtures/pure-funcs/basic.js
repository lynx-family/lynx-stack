NativeModules.call('background-only')
lynx.registerDataProcessors('main-thread-only')
console.info('default console.info')
console.warn('default console.warn')

export const sentinel = 'pure-funcs'
