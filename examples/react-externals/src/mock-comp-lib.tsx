export {};

if (
  __MAIN_THREAD__
  && typeof lynx !== 'undefined'
  && typeof lynx.fetchBundle === 'function'
) {
  const origFetchBundle = lynx.fetchBundle.bind(lynx);
  lynx.fetchBundle = ((url: string, options?: Record<string, unknown>) => {
    const handler = origFetchBundle(url, options);
    if (!String(url).includes('comp-lib.lynx.bundle')) {
      return handler;
    }
    return {
      wait(timeout: number) {
        return handler.wait(timeout);
      },
      then(
        onFulfilled: (response: unknown) => unknown,
        onRejected?: (error: unknown) => unknown,
      ) {
        let response: unknown;
        try {
          response = handler.wait(5);
        } catch (error) {
          if (onRejected) return onRejected(error);
          throw error;
        }
        return onFulfilled(response);
      },
    };
  }) as typeof lynx.fetchBundle;
}
