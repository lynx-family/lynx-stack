import type { RsbuildPlugin, Rspack } from '@rsbuild/core';

export function syncThenMvp(mode: string): RsbuildPlugin {
  return {
    name: 'sync-then-mvp',
    setup(api) {
      api.modifyRspackConfig(config => {
        config.cache = false;
        config.optimization ??= {};
        config.optimization.minimize = false;
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler: Rspack.Compiler) {
            const { RuntimeModule, RuntimeGlobals } = compiler.webpack;
            class Probe extends RuntimeModule {
              constructor(private layer: string) {
                super(
                  'sync-then-mvp-probe',
                  -100 as typeof RuntimeModule.STAGE_NORMAL,
                );
              }
              override generate() {
                return `
if (!globalThis.__syncExternalProbe) {
  var probe = globalThis.__syncExternalProbe = {
    events: [], created: 0, depth: 0, firstRenderCreated: null, entryRegistered: false,
    mode: ${JSON.stringify(mode)}, layer: ${JSON.stringify(this.layer)}
  };
  probe.mark = function(event, detail) {
    var record = {layer: probe.layer, mode: probe.mode, event: event, detail: detail, created: probe.created};
    probe.events.push(record);
    if (typeof console !== 'undefined') console.info('[sync-then-mvp]', JSON.stringify(record));
  };
  var nativeFetch = lynx.fetchBundle.bind(lynx);
  lynx.fetchBundle = function(url, options) {
    var handler = nativeFetch(url, options);
    return {
      wait: function(timeout) { return handler.wait(timeout); },
      then: function(onFulfilled, onRejected) {
        probe.mark('fetch:then:enter', url);
        if (probe.mode === 'async') return handler.then(function(response) {
          probe.mark('fetch:then:callback', url);
          return onFulfilled(response);
        }, onRejected);
        var response;
        try { response = handler.wait(5); }
        catch (error) { if (onRejected) return onRejected(error); throw error; }
        probe.mark('fetch:then:callback', url);
        var result = onFulfilled(response);
        probe.mark('fetch:then:return', url);
        return result;
      }
    };
  };
  ['__CreateView', '__CreateText', '__CreateImage', '__CreatePage'].forEach(function(name) {
    var original = globalThis[name];
    if (typeof original !== 'function') return;
    globalThis[name] = function() { probe.created++; return original.apply(this, arguments); };
  });
  var define = Object.defineProperty;
  var wrapRender = function(render) {
    if (typeof render !== 'function') return render;
    return function() {
      probe.mark('renderPage:enter');
      var before = probe.created;
      try { return render.apply(this, arguments); }
      finally {
        var created = probe.created - before;
        if (probe.firstRenderCreated === null) probe.firstRenderCreated = created;
        probe.mark('renderPage:return', created);
      }
    };
  };
  Object.defineProperty = function(target, key, descriptor) {
    if (target === globalThis && key === 'renderPage') {
      if (descriptor.get) {
        var get = descriptor.get;
        descriptor.get = function() { return wrapRender(get.call(this)); };
      } else if (descriptor.value) descriptor.value = wrapRender(descriptor.value);
    }
    return define(target, key, descriptor);
  };
  function SyncPromise(executor) {
    var NativePromise = Promise;
    var state = 0, value, nativeResolve, nativeReject, locked = false;
    var promise = new NativePromise(function(resolve, reject) { nativeResolve = resolve; nativeReject = reject; });
    var nativeThen = promise.then.bind(promise);
    function fail(error) { state = 2; value = error; nativeReject(error); }
    function adopt(next) {
      if (next === promise) { fail(new TypeError('Promise cannot resolve itself')); return; }
      try {
        if (next && typeof next.then === 'function') {
          var called = false;
          next.then(function(result) { if (!called) { called = true; adopt(result); } }, function(error) { if (!called) { called = true; fail(error); } });
          return;
        }
        state = 1; value = next; nativeResolve(next);
      } catch (error) { if (!state && !called) fail(error); }
    }
    function resolve(next) { if (!locked) { locked = true; adopt(next); } }
    function reject(error) { if (!locked) { locked = true; fail(error); } }
    promise.then = function(onFulfilled, onRejected) {
      if (!state) return nativeThen(onFulfilled, onRejected);
      nativeThen(undefined, function() {});
      return new SyncPromise(function(resolve, reject) {
        var callback = state === 1 ? onFulfilled : onRejected;
        if (typeof callback !== 'function') { (state === 1 ? resolve : reject)(value); return; }
        try { resolve(callback(value)); } catch (error) { reject(error); }
      });
    };
    promise.catch = function(onRejected) { return promise.then(undefined, onRejected); };
    promise.finally = function(callback) {
      if (typeof callback !== 'function') return promise.then();
      return promise.then(function(value) { return SyncPromise.resolve(callback()).then(function() { return value; }); }, function(error) { return SyncPromise.resolve(callback()).then(function() { throw error; }); });
    };
    try { executor(resolve, reject); } catch (error) { reject(error); }
    return promise;
  }
  SyncPromise.resolve = function(value) { return new SyncPromise(function(resolve) { resolve(value); }); };
  probe.Promise = SyncPromise;
  probe.mark('probe:installed');
}
`;
              }
            }
            class StartupProbe extends RuntimeModule {
              constructor() {
                super(
                  'sync-then-mvp-startup',
                  100 as typeof RuntimeModule.STAGE_NORMAL,
                );
              }
              override generate() {
                return `
var originalStartup = ${RuntimeGlobals.startup};
${RuntimeGlobals.startup} = function() {
  var probe = globalThis.__syncExternalProbe;
  probe.depth++;
  probe.mark('startup:enter');
  try { return originalStartup(); }
  finally { probe.depth--; probe.mark('startup:return', probe.entryRegistered); }
};
`;
              }
            }
            if (mode !== 'baseline') {
              const rewrite = (value: unknown): unknown => {
                if (typeof value === 'string') {
                  return value.replaceAll(
                    'Promise.resolve(',
                    'globalThis.__syncExternalProbe.Promise.resolve(',
                  );
                }
                if (Array.isArray(value)) {
                  return value.map(item => rewrite(item));
                }
                if (
                  value && typeof value === 'object'
                  && !(value instanceof RegExp)
                ) {
                  return Object.fromEntries(
                    Object.entries(value).map((
                      [key, item],
                    ) => [key, rewrite(item)]),
                  );
                }
                return value;
              };
              compiler.hooks.environment.tap({
                name: 'sync-then-mvp',
                stage: 100,
              }, () => {
                const items = Array.isArray(compiler.options.externals)
                  ? compiler.options.externals
                  : [compiler.options.externals];
                compiler.options.externals = items.map(
                  (item): Rspack.ExternalItem => {
                    if (typeof item === 'function' && item.length > 1) {
                      return (data, callback) => {
                        const resolver = item as (
                          data: Rspack.ExternalItemFunctionData,
                          callback: (
                            error?: Error,
                            result?: Rspack.ExternalItemValue,
                            type?: Rspack.ExternalsType,
                          ) => void,
                        ) => unknown;
                        resolver(
                          data,
                          (error, result, type) =>
                            callback(
                              error,
                              rewrite(result) as Rspack.ExternalItemValue,
                              type,
                            ),
                        );
                      };
                    }
                    return rewrite(item) as Rspack.ExternalItem;
                  },
                );
              });
            }
            compiler.hooks.compilation.tap('sync-then-mvp', compilation => {
              if (mode !== 'baseline') {
                compilation.hooks.runtimeModule.tap('sync-then-mvp', module => {
                  if (!module.source) {
                    return;
                  }
                  let source = module.source.source.toString();
                  if (/async.?module/.test(module.name)) {
                    if (!source.includes('var obj = {};')) {
                      throw new Error('Unexpected Rspack async-module runtime');
                    }
                    source = source.replace('var obj = {};', '').replace(
                      'dep.then(',
                      'var obj = {};\n dep.then(',
                    );
                    source = source.replaceAll(
                      'new Promise(',
                      'new globalThis.__syncExternalProbe.Promise(',
                    );
                  } else if (
                    module.name.includes('externals-loading-runtime')
                  ) {
                    source = source.replace(
                      'asyncPromise = new Promise(',
                      'asyncPromise = new globalThis.__syncExternalProbe.Promise(',
                    )
                      .replace(
                        'function createLoadExternalAsync(handler, sectionPath) {\n  return new Promise(',
                        'function createLoadExternalAsync(handler, sectionPath) {\n  return new globalThis.__syncExternalProbe.Promise(',
                      )
                      .replace(
                        'new Promise(resolve => resolve(createLoadExternalSync',
                        'new globalThis.__syncExternalProbe.Promise(resolve => resolve(createLoadExternalSync',
                      );
                  }
                  if (source !== module.source.source.toString()) {
                    module.source.source = Buffer.from(source);
                  }
                });
              }
              compilation.hooks.additionalTreeRuntimeRequirements.tap({
                name: 'sync-then-mvp',
                stage: 100,
              }, (chunk, requirements) => {
                if (!chunk.hasRuntime()) return;
                compilation.addRuntimeModule(
                  chunk,
                  new Probe(
                    chunk.name?.includes('__main-thread')
                      ? 'main'
                      : 'background',
                  ),
                );
                if (requirements.has(RuntimeGlobals.startup)) {
                  compilation.addRuntimeModule(chunk, new StartupProbe());
                }
              });
            });
          },
        });
      });
    },
  };
}
