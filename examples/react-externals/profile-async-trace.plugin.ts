import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

const RUNTIME_HELPER = `
var __lynxAsyncTrace = globalThis.__lynxAsyncTrace;
if (!__lynxAsyncTrace) {
  var _perf = function() {
    return typeof lynx !== 'undefined' ? lynx.performance : undefined;
  };
  var _toStringArgs = function(args) {
    if (!args) return undefined;
    var out = {};
    for (var k in args) {
      if (Object.prototype.hasOwnProperty.call(args, k)) {
        out[k] = String(args[k]);
      }
    }
    return out;
  };
  __lynxAsyncTrace = globalThis.__lynxAsyncTrace = {
    start: function(name, args) {
      var p = _perf();
      if (p && typeof p.profileStart === 'function') {
        var strArgs = _toStringArgs(args);
        p.profileStart(name, strArgs ? { args: strArgs } : undefined);
      }
    },
    end: function() {
      var p = _perf();
      if (p && typeof p.profileEnd === 'function') {
        p.profileEnd();
      }
    },
    mark: function(name, args) {
      var p = _perf();
      if (p && typeof p.profileMark === 'function') {
        var strArgs = _toStringArgs(args);
        p.profileMark(name, strArgs ? { args: strArgs } : undefined);
      }
    }
  };

  if (typeof lynx !== 'undefined') {
    if (typeof lynx.fetchBundle === 'function') {
      var _origFetchBundle = lynx.fetchBundle.bind(lynx);
      lynx.fetchBundle = function(url, options) {
        __lynxAsyncTrace.start('external:fetchBundle', { url: String(url) });
        var handler;
        try {
          handler = _origFetchBundle(url, options);
        } finally {
          __lynxAsyncTrace.end();
        }
        if (!handler || typeof handler !== 'object') return handler;
        var hasThen = typeof handler.then === 'function';
        var hasWait = typeof handler.wait === 'function';
        return {
          wait: function(timeout) {
            __lynxAsyncTrace.start('external:fetchBundle.wait', { url: String(url), timeout: timeout });
            try {
              return hasWait ? handler.wait(timeout) : undefined;
            } finally {
              __lynxAsyncTrace.end();
            }
          },
          then: function(onFulfilled, onRejected) {
            __lynxAsyncTrace.mark('external:fetchBundle.then:register', { url: String(url) });
            if (!hasThen) return undefined;
            return handler.then(
              function(res) {
                __lynxAsyncTrace.start('external:fetchBundle.then:callback', {
                  url: String(url),
                  code: res && res.code
                });
                try {
                  return onFulfilled ? onFulfilled(res) : res;
                } finally {
                  __lynxAsyncTrace.end();
                }
              },
              function(err) {
                __lynxAsyncTrace.start('external:fetchBundle.then:reject', { url: String(url) });
                try {
                  if (onRejected) return onRejected(err);
                  throw err;
                } finally {
                  __lynxAsyncTrace.end();
                }
              }
            );
          }
        };
      };
    }

    if (typeof lynx.loadScript === 'function') {
      var _origLoadScript = lynx.loadScript;
      var _wrappedLoadScript = function(sectionPath, options) {
        __lynxAsyncTrace.start('external:loadScript', {
          sectionPath: String(sectionPath),
          bundleName: options && options.bundleName ? String(options.bundleName) : ''
        });
        try {
          return _origLoadScript.call(lynx, sectionPath, options);
        } finally {
          __lynxAsyncTrace.end();
        }
      };
      if ('cache' in _origLoadScript) {
        Object.defineProperty(_wrappedLoadScript, 'cache', {
          configurable: true,
          enumerable: true,
          get: function() { return _origLoadScript.cache; },
          set: function(v) { _origLoadScript.cache = v; }
        });
      }
      lynx.loadScript = _wrappedLoadScript;
    }
  }

  var _origDefineProperty = Object.defineProperty;
  var _wrapRenderPage = function(fn) {
    if (typeof fn !== 'function' || fn.__lynxTraceWrapped) return fn;
    var wrapped = function() {
      __lynxAsyncTrace.start('lynx:renderPage');
      try {
        return fn.apply(this, arguments);
      } finally {
        __lynxAsyncTrace.end();
      }
    };
    wrapped.__lynxTraceWrapped = true;
    return wrapped;
  };
  Object.defineProperty = function(target, key, descriptor) {
    if (target === globalThis && key === 'renderPage' && descriptor) {
      if (descriptor.get) {
        var origGet = descriptor.get;
        descriptor.get = function() {
          return _wrapRenderPage(origGet.call(this));
        };
      } else if (descriptor.value) {
        descriptor.value = _wrapRenderPage(descriptor.value);
      }
    }
    return _origDefineProperty.call(Object, target, key, descriptor);
  };
}
`;

function instrumentBundleSource(source: string): string {
  let out = source;

  // 1. Instrument __webpack_require__.a (Rspack async module runtime)
  out = out.replace(
    /__webpack_require__\.a = \(module, body, hasAwait, useModuleExports\) => \{[\s\S]*?\n\};/,
    match => {
      let patched = match;
      patched = patched.replace(
        '__webpack_require__.a = (module, body, hasAwait, useModuleExports) => {',
        `__webpack_require__.a = (module, body, hasAwait, useModuleExports) => {
  __lynxAsyncTrace.start('rspack:asyncModule:enter', { id: module.id, hasAwait: !!hasAwait });
  try {`,
      );
      patched = patched.replace(
        'var promise = new Promise((resolve, rej) => {',
        `__lynxAsyncTrace.mark('rspack:asyncModule:promiseCreate', { id: module.id });
  var promise = new Promise((resolve, rej) => {`,
      );
      patched = patched.replace(
        'var handle = (deps) => {',
        `var handle = (deps) => {
    __lynxAsyncTrace.start('rspack:handleAsyncDeps', { id: module.id, depsCount: deps ? deps.length : 0 });
    try {`,
      );
      patched = patched.replace(
        'fn = () => (resolve(getResult));',
        `fn = () => { __lynxAsyncTrace.mark('rspack:handleAsyncDeps:promiseResolve', { id: module.id }); resolve(getResult); };`,
      );
      patched = patched.replace(
        'return fn.r ? promise : getResult();',
        `if (fn.r) {
      __lynxAsyncTrace.mark('rspack:handleAsyncDeps:asyncPending', { id: module.id, pending: fn.r });
      return promise;
    }
    __lynxAsyncTrace.mark('rspack:handleAsyncDeps:syncImmediate', { id: module.id });
    return getResult();
    } finally { __lynxAsyncTrace.end(); }`,
      );
      patched = patched.replace(
        'var done = (err) => (',
        `var done = (err) => { __lynxAsyncTrace.start('rspack:asyncModule:done', { id: module.id, hasErr: !!err }); try { return (`,
      );
      patched = patched.replace(
        'promise[rspackDone] = true);',
        `promise[rspackDone] = true); } finally { __lynxAsyncTrace.end(); } };`,
      );
      patched = patched.replace(
        'body(handle, done, asyncModule);',
        `__lynxAsyncTrace.start('rspack:asyncModule:bodySync', { id: module.id });
  try {
    body(handle, done, asyncModule);
  } finally {
    __lynxAsyncTrace.end();
  }`,
      );
      patched = patched.replace(
        /\n\};$/,
        `\n  } finally { __lynxAsyncTrace.end(); }\n};`,
      );
      return patched;
    },
  );

  // 2. Instrument await __rspack_async_deps in async modules
  out = out.replace(
    /var __rspack_async_deps = __rspack_load_async_deps\(([^)]+)\);\n([^\n]+?) = \(__rspack_async_deps\.then \? \(await __rspack_async_deps\)\(\) : __rspack_async_deps\)\[0\];/g,
    (_m, depsArg, targetVar) =>
      `__lynxAsyncTrace.start('rspack:loadAsyncDeps');
var __rspack_async_deps = __rspack_load_async_deps(${depsArg});
__lynxAsyncTrace.end();
__lynxAsyncTrace.mark('rspack:beforeAwaitAsyncDeps', { isAsync: !!__rspack_async_deps.then });
${targetVar} = (__rspack_async_deps.then ? (await __rspack_async_deps)() : __rspack_async_deps)[0];
__lynxAsyncTrace.mark('rspack:afterAwaitAsyncDeps', { isAsync: !!__rspack_async_deps.then });`,
  );

  // 3. Instrument deferExternal getter & mount setter
  out = out.replace(
    `function mount(value) {
    Object.defineProperty(globals, name, {
      value, writable: true, enumerable: true, configurable: true
    });
    return value;
  }
  Object.defineProperty(globals, name, {
    configurable: true,
    enumerable: true,
    get() { return mount(load()); },
    set: mount
  });`,
    `function mount(value) {
    __lynxAsyncTrace.mark('external:mount', { name: name, isPromise: !!(value && typeof value.then === 'function') });
    Object.defineProperty(globals, name, {
      value, writable: true, enumerable: true, configurable: true
    });
    return value;
  }
  Object.defineProperty(globals, name, {
    configurable: true,
    enumerable: true,
    get() {
      __lynxAsyncTrace.start('external:deferGet', { name: name });
      try {
        return mount(load());
      } finally {
        __lynxAsyncTrace.end();
      }
    },
    set: mount
  });`,
  );

  // 4. Instrument createLoadExternalAsync
  out = out.replace(
    `function createLoadExternalAsync(handler, sectionPath) {
  return new Promise((resolve, reject) => {
    handler.then((response) => {`,
    `function createLoadExternalAsync(handler, sectionPath) {
  __lynxAsyncTrace.mark('external:createLoadAsync:promiseCreate', { sectionPath: sectionPath });
  return new Promise((resolve, reject) => {
    handler.then((response) => {
      __lynxAsyncTrace.start('external:createLoadAsync:thenCallback', { sectionPath: sectionPath, code: response && response.code });
      try {`,
  );
  out = out.replace(
    `    }, reject)
  })
}`,
    `      } finally {
        __lynxAsyncTrace.end();
      }
    }, reject)
  })
}`,
  );

  // 5. Instrument entry startup require("./src/index.tsx")
  out = out.replace(
    /var __webpack_exports__ = __webpack_require__\("(\(react:[^)]+\)\/\.\/src\/index\.tsx)"\);/,
    (_m, entryId) =>
      `__lynxAsyncTrace.start('entry:startup', { entry: '${entryId}' });
try {
  var __webpack_exports__ = __webpack_require__("${entryId}");
} finally {
  __lynxAsyncTrace.end();
}`,
  );

  return out;
}

export function pluginProfileAsyncTrace(): RsbuildPlugin {
  return {
    name: 'profile-async-trace',
    setup(api) {
      api.modifyRspackConfig(config => {
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            const { RuntimeModule, Compilation, sources } = compiler.webpack;

            class TraceRuntimeModule extends RuntimeModule {
              constructor() {
                super(
                  'profile-async-trace-runtime',
                  -100 as typeof RuntimeModule.STAGE_NORMAL,
                );
              }
              override generate() {
                return RUNTIME_HELPER;
              }
            }

            compiler.hooks.thisCompilation.tap(
              'profile-async-trace',
              compilation => {
                compilation.hooks.additionalTreeRuntimeRequirements.tap(
                  'profile-async-trace',
                  chunk => {
                    compilation.addRuntimeModule(
                      chunk,
                      new TraceRuntimeModule(),
                    );
                  },
                );

                compilation.hooks.processAssets.tap(
                  {
                    name: 'profile-async-trace',
                    stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
                  },
                  assets => {
                    for (const [name, asset] of Object.entries(assets)) {
                      if (!name.endsWith('.js')) continue;
                      const original = asset.source().toString();
                      if (
                        !original.includes('__webpack_require__.a')
                        && !original.includes('__rspack_load_async_deps')
                      ) {
                        continue;
                      }
                      const updated = instrumentBundleSource(original);
                      if (updated !== original) {
                        compilation.updateAsset(
                          name,
                          new sources.RawSource(updated),
                        );
                      }
                    }
                  },
                );
              },
            );
          },
        });
      });
    },
  };
}
