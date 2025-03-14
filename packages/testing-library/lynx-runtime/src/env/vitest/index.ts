const env = {
  name: 'lynxRuntime',
  transformMode: 'web',
  async setup(global) {
    const { LynxRuntime } = await import(
      '@lynx-js/lynx-runtime'
    );
    const lynxRuntime = new LynxRuntime();
    global.lynxRuntime = lynxRuntime;

    return {
      teardown(global) {
        delete global.lynxRuntime;
      },
    };
  },
};

export default env;
