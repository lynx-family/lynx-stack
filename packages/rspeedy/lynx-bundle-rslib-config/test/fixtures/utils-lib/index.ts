import '@lynx-js/react'

export function add(a: number, b: number): number {
  return a + b
}
// @ts-expect-error
export const abc: any = globalThis?.abc || 0

console.log('defineDCE', {
  isMainThread: __MAIN_THREAD__,
  isLepus: __LEPUS__,
  isBackground: __BACKGROUND__,
})

console.log('define', {
  isDev: __DEV__,
  isProfile: __PROFILE__,
})

console.log('process.env.NODE_ENV', {
  NODE_ENV: process.env['NODE_ENV'],
})
