export {};

if (__MAIN_THREAD__) {
  const loadScript = lynx.loadScript.bind(lynx);
  lynx.loadScript = ((section, options) => {
    if (section !== './App.js__main-thread') {
      return loadScript(section, options);
    }
    console.info(
      `[native-repro] ${Date.now()} comp-lib fetched; delaying execution 2000ms`,
    );
    return new Promise(resolve => {
      (lynx as unknown as {
        setTimeout: (callback: () => void, ms: number) => void;
      }).setTimeout(() => {
        console.info(
          `[native-repro] ${Date.now()} executing comp-lib on main thread`,
        );
        resolve(loadScript(section, options));
      }, 2000);
    });
  }) as typeof lynx.loadScript;
}
