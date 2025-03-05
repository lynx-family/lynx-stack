const env = {
  name: 'lynxdom',
  transformMode: 'web',
  async setup(global: any) {
    const { LynxDOM } = await import(
      '@lynx-js/lynx-dom'
    );
    const lynxDOM = new LynxDOM();
    global.lynxDOM = lynxDOM;

    return {
      teardown(global: any) {
        delete global.lynxDOM;
      },
    };
  },
};

export default env;
