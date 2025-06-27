import type {} from '@lynx-js/react';
import { __root, __page } from '@lynx-js/react/internal';

export function setupReactLynx() {
  if (__BACKGROUND__) {
    try {
      // @ts-ignore
      if (typeof lynx.getDevtool !== 'function') {
        throw new Error(
          '`lynx.getDevtool` is not a function. Please upgrade your LynxSDK to the latest version.',
        );
      }

      // @ts-ignore
      globalThis.preactDevtoolsCtx ||= {};

      const __DEBUG__ = globalThis.preactDevtoolsCtx.__DEBUG__;
      if (__DEBUG__) {
        console.log('[PREACT DEVTOOLS] debug mode is enabled');
      }

      if (__DEBUG__) {
        // For quick debug in HDT console
        Object.assign(preactDevtoolsCtx, {
          lynx,
          __page,
          __root,
          // @ts-ignore
          lynxCoreInject,
        });
      }

      const listeners: Record<
        string,
        ((e: { source: any; data: any }) => void)[]
      > = {};
      preactDevtoolsCtx.addEventListener = (type, callback) => {
        if (!listeners[type]) {
          listeners[type] = [];
        }
        listeners[type].push(callback);
      };
      preactDevtoolsCtx.postMessage = (
        { source, type, data },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _targetOrigin,
      ) => {
        for (let i = 0; i < (listeners['message']?.length ?? 0); i++) {
          listeners['message']?.[i]?.({
            // in-App to-self message
            source: preactDevtoolsCtx,
            data: {
              source,
              type,
              data,
            },
          });
        }

        if (__DEBUG__) {
          // App -> Devtools
          console.log('lynx.getDevtool().dispatchEvent', {
            source,
            type,
            data,
          });
        }
        // @ts-ignore
        lynx.getDevtool().dispatchEvent({
          type: 'PreactDevtools',
          data: JSON.stringify({
            source,
            type,
            data,
          }),
        });
      };

      // @ts-ignore
      lynx.getDevtool().addEventListener('PreactDevtools', (e) => {
        const dataObj = JSON.parse(e.data);
        if (__DEBUG__) {
          console.log('hdt -> frontend message received', dataObj);
        }
        const { source, type, data } = dataObj;

        for (let i = 0; i < (listeners['message']?.length ?? 0); i++) {
          listeners['message']?.[i]?.({
            source: preactDevtoolsCtx,
            data: {
              source,
              type,
              data,
            },
          });
        }
      });

      if (
        typeof preactDevtoolsCtx.localStorage === 'undefined'
        || preactDevtoolsCtx.localStorage === null
      ) {
        const storage: Record<string, string> = {};

        preactDevtoolsCtx.localStorage = {
          getItem: function(key) {
            if (__DEBUG__) console.log(`getItem called with key: ${key}`);
            return storage.hasOwnProperty(key) ? storage[key] ?? null : null;
          },
          setItem: function(key, value) {
            if (__DEBUG__) {
              console.log(`setItem called with key: ${key}, value: ${value}`);
            }
            storage[key] = value.toString();
          },
          removeItem: function(key) {
            if (__DEBUG__) console.log(`removeItem called with key: ${key}`);
            delete storage[key];
          },
          clear: function() {
            if (__DEBUG__) console.log('clear called');
            for (const key in storage) {
              if (storage.hasOwnProperty(key)) {
                delete storage[key];
              }
            }
          },
          key: function(index) {
            if (__DEBUG__) console.log(`key called with index: ${index}`);
            const keys = Object.keys(storage);
            return keys[index] || null;
          },
          get length() {
            if (__DEBUG__) console.log('length property accessed');
            return Object.keys(storage).length;
          },
        };
      }

      if (
        typeof preactDevtoolsCtx.performance === 'undefined'
        || preactDevtoolsCtx.performance === null
      ) {
        if (__DEBUG__) console.log('Mocking performance API...');

        const marks: any[] = [];
        const measures: any[] = [];
        const startTime = Date.now();

        preactDevtoolsCtx.performance = {
          now: function() {
            // 返回自浏览器上下文被完全加载并设立以来经过的毫秒数
            return Date.now() - startTime;
          },
          // @ts-ignore
          mark: function(markName) {
            if (__DEBUG__) {
              console.log(`performance.mark called with markName: ${markName}`);
            }
            marks.push({
              name: markName,
              entryType: 'mark',
              startTime: this.now(),
              duration: 0,
            });
          },
          // @ts-ignore
          measure: function(measureName, startMark, endMark) {
            if (__DEBUG__) {
              console.log(
                `performance.measure called with measureName: ${measureName}, startMark: ${startMark}, endMark: ${endMark}`,
              );
            }
            const start = marks.find((mark) => mark.name === startMark);
            const end = marks.find((mark) => mark.name === endMark);
            if (start && end) {
              measures.push({
                name: measureName,
                entryType: 'measure',
                startTime: start.startTime,
                duration: end.startTime - start.startTime,
              });
            } else {
              if (__DEBUG__) {
                console.warn('Invalid marks for performance.measure');
              }
            }
          },
          getEntriesByType: function(type) {
            if (__DEBUG__) {
              console.log(
                `performance.getEntriesByType called with type: ${type}`,
              );
            }
            if (type === 'mark') {
              return [...marks];
            } else if (type === 'measure') {
              return [...measures];
            }
            return [];
          },
          clearMarks: function(markName) {
            if (__DEBUG__) {
              console.log(
                `performance.clearMarks called with markName: ${markName}`,
              );
            }
            if (markName) {
              for (let i = marks.length - 1; i >= 0; i--) {
                if (marks[i].name === markName) {
                  marks.splice(i, 1);
                }
              }
            } else {
              marks.length = 0; // Clear all marks
            }
          },
          clearMeasures: function(measureName) {
            if (__DEBUG__) {
              console.log(
                `performance.clearMeasures called with measureName: ${measureName}`,
              );
            }
            if (measureName) {
              for (let i = measures.length - 1; i >= 0; i--) {
                if (measures[i].name === measureName) {
                  measures.splice(i, 1);
                }
              }
            } else {
              measures.length = 0; // Clear all measures
            }
          },
        };
      }

      // Shims for:
      // const treeParent = ...
      if (
        typeof preactDevtoolsCtx.Node === 'undefined'
        || preactDevtoolsCtx.Node === null
      ) {
        // @ts-ignore
        preactDevtoolsCtx.Node = __root.__proto__.constructor;
      }
      // }
      // Shims for:
      // const sorted = sortRoots(document.body, roots);
      if (
        typeof preactDevtoolsCtx.document === 'undefined'
        || preactDevtoolsCtx.document === null
      ) {
        preactDevtoolsCtx.document = {
          // @ts-ignore
          body: __root,
        };
      }
      // Shims for:
      // else if (data instanceof window.Blob) {
      if (
        typeof preactDevtoolsCtx.Blob === 'undefined'
        || preactDevtoolsCtx.Blob === null
      ) {
        // @ts-ignore
        preactDevtoolsCtx.Blob = class Blob {
          constructor(parts: any, options: any) {
            if (__DEBUG__) console.log('Blob constructor', parts, options);
          }
        };
      }

      require('../shells/shared/installHook');
      require('preact/devtools');

      console.log('[PREACT DEVTOOLS] Devtools initialized successfully');
    } catch (e) {
      console.warn('[PREACT DEVTOOLS] Devtools failed to initialize:');
      console.warn(e);
    }
  }
}
