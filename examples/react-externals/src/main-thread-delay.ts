// Opt-in diagnostic: delay evaluation, after the component bundle was fetched.
export {};

declare const __COMP_LIB_MAIN_THREAD_DELAY_MS__: number;
declare const __HOST_RENDER_PAGE_DELAY_MS__: number;

const started = Date.now();
const thread = __MAIN_THREAD__ ? 'main' : 'background';
const log = (message: string) => {
  console.info(
    `[external-race] ${thread} +${Date.now() - started}ms ${message}`,
  );
};

const schedule = (callback: () => void, delay: number) => {
  const timer = (lynx as unknown as {
    setTimeout: (callback: () => void, delay: number) => void;
  }).setTimeout;
  timer(callback, delay);
};

if (__MAIN_THREAD__) {
  const loader = lynx.loadScript.bind(lynx);
  lynx.loadScript = ((section, options) => {
    if (section === './App.js__main-thread') {
      log('comp-lib fetched; delaying main-thread evaluation');
      return new Promise((resolve, reject) => {
        schedule(() => {
          try {
            log('comp-lib main-thread evaluation starts');
            resolve(loader(section, options));
            log('comp-lib main-thread loadScript returned');
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }, __COMP_LIB_MAIN_THREAD_DELAY_MS__);
      });
    }
    return loader(section, options);
  }) as typeof lynx.loadScript;
}

if (__MAIN_THREAD__) {
  for (const name of ['renderPage', 'rLynxChange']) {
    const globals = globalThis as unknown as Record<string, unknown>;
    const descriptor = Object.getOwnPropertyDescriptor(globals, name);
    let current = globals[name];
    const wrap = (value: unknown) =>
      typeof value === 'function'
        ? function(this: unknown, ...args: unknown[]) {
          log(`${name} called`);
          if (name === 'rLynxChange') {
            const patch = args[0] as {
              data: string;
              patchOptions: { isHydration?: boolean };
            };
            const data = JSON.parse(patch.data) as {
              patchList: { snapshotPatch?: unknown[] }[];
            };
            log(`patch ${
              JSON.stringify({
                isHydration: patch.patchOptions.isHydration,
                operations: data.patchList.map(item => ({
                  length: item.snapshotPatch?.length,
                  first: item.snapshotPatch?.slice(0, 3),
                })),
              })
            }`);
          }
          return Reflect.apply(value, this, args) as unknown;
        }
        : value;
    current = wrap(current);
    if (name === 'renderPage' && __HOST_RENDER_PAGE_DELAY_MS__ > 0) {
      // Model a host calling renderPage after the runtime initialized, while
      // the component external is still pending. Do not send patches ourselves.
      current = (...args: unknown[]) => {
        schedule(() => {
          log('host invokes current renderPage after runtime initialization');
          Reflect.apply(
            globals[name] as (...values: unknown[]) => unknown,
            globals,
            args,
          );
        }, __HOST_RENDER_PAGE_DELAY_MS__);
      };
    }
    Object.defineProperty(globals, name, {
      configurable: true,
      get: () => current,
      set: (value: unknown) => {
        log(`${name} installed`);
        if (descriptor?.set && descriptor.get) {
          // Observe the startup accessor without replacing its registration
          // semantics; otherwise this diagnostic would disable the fix.
          descriptor.set.call(globals, value);
          current = wrap(descriptor.get.call(globals));
        } else {
          current = wrap(value);
        }
      },
    });
  }
  const globals = globalThis as unknown as Record<string, unknown>;
  const lifecycle = globals['__OnLifecycleEvent'];
  if (typeof lifecycle === 'function') {
    globals['__OnLifecycleEvent'] = (...args: unknown[]) => {
      const event = args[0] as [string, { root: string }];
      if (event[0] === 'rLynxFirstScreen') {
        const root = JSON.parse(event[1].root) as { children?: unknown[] };
        log(`first-screen children=${root.children?.length ?? 0}`);
      }
      return Reflect.apply(lifecycle, globals, args) as unknown;
    };
  }
}

log('diagnostic installed');
