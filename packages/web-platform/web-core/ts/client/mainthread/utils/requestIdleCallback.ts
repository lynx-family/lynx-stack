// Safari doesn't support requestIdleCallback
export const requestIdleCallbackImpl =
  typeof requestIdleCallback === 'undefined'
    ? (callback: () => void) => setTimeout(callback, 16)
    : requestIdleCallback;
