export const statusPromise = () => {
  let resolve: (() => void) | undefined;
  const promise = new Promise((res) => {
    resolve = res as any;
  });
  return {
    promise,
    complete: () => resolve?.(),
  };
};
