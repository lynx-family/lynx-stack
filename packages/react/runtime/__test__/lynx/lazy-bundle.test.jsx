// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { render } from 'preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

/* global lynx */

describe('loadLazyBundle', () => {
  describe('main thread', () => {
    beforeEach(() => {
      vi
        .unstubAllGlobals()
        .stubGlobal('__LEPUS__', true)
        .stubGlobal('__MAIN_THREAD__', true);
    });

    test('should not have lynx.loadLazyBundle when not used', () => {
      expect(lynx.loadLazyBundle).toBeUndefined();
    });

    test('should have lynx.loadLazyBundle', async () => {
      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      expect(lynx.loadLazyBundle).toBe(loadLazyBundle);
    });

    test('blocking __QueryComponent', async () => {
      const __QueryComponent = vi.fn();
      __QueryComponent.mockReturnValueOnce({ evalResult: { data: 'foo' } });
      vi.stubGlobal('__QueryComponent', __QueryComponent);

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(__QueryComponent).toBeCalledWith('foo');

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
      });

      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      promise2.then((data) => {
        expect(data).toBeUndefined();
        thenCalled = true;
      });
      expect(thenCalled).toBeTruthy();

      expect.assertions(5);
    });

    test('blocking __QueryComponent with primitive returns', async () => {
      const __QueryComponent = vi.fn();
      __QueryComponent.mockReturnValueOnce({ evalResult: { data: 'foo' } });
      vi.stubGlobal('__QueryComponent', __QueryComponent);

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(__QueryComponent).toBeCalledWith('foo');

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        return 'bar';
      });

      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      promise2.then((data) => {
        expect(data).toBe('bar');
        thenCalled = true;
      });
      expect(thenCalled).toBeTruthy();
    });

    test('blocking __QueryComponent without onFulfilled', async () => {
      const __QueryComponent = vi.fn();
      __QueryComponent.mockReturnValueOnce({ evalResult: { data: 'foo' } });
      vi.stubGlobal('__QueryComponent', __QueryComponent);

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(__QueryComponent).toBeCalledWith('foo');

      let thenCalled = false;
      const promise2 = promise.then();

      promise2.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
      });
      expect(thenCalled).toBeTruthy();
    });

    test('blocking __QueryComponent with thenable returns', async () => {
      const __QueryComponent = vi.fn();
      __QueryComponent.mockReturnValueOnce({ evalResult: { data: 'foo' } });
      vi.stubGlobal('__QueryComponent', __QueryComponent);

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(__QueryComponent).toBeCalledWith('foo');

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        return {
          then(onFulfilled) {
            return onFulfilled('bar');
          },
        };
      });

      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      const promise3 = promise2.then((data) => {
        expect(data).toBe('bar');
        thenCalled = true;
        return Promise.resolve('baz');
      });
      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      const promise4 = promise3.then((data) => {
        expect(data).toBe('baz');
        return data;
      });
      expect(thenCalled).toBe(false);

      await expect(promise4).resolves.toBe('baz');
      expect.assertions(8);
    });

    test('blocking __QueryComponent with throw in onFulfilled', async () => {
      const __QueryComponent = vi.fn();
      __QueryComponent.mockReturnValueOnce({ evalResult: { data: 'foo' } });
      vi.stubGlobal('__QueryComponent', __QueryComponent);

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(__QueryComponent).toBeCalledWith('foo');

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        throw new Error('err');
      });

      expect(thenCalled).toBeTruthy();

      await expect(promise2).rejects.toThrow('err');
    });

    test.todo('blocking __QueryComponent with onRejected');
    test.todo('blocking __QueryComponent with throw in onRejected');

    test('non-blocking __QueryComponent', async () => {
      const __QueryComponent = vi.fn();
      __QueryComponent.mockReturnValueOnce(undefined);
      vi.stubGlobal('__QueryComponent', __QueryComponent);

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(__QueryComponent).toBeCalledWith('foo');

      promise.then(() => {
        expect.fail('non-blocking __QueryComponent should never resolve');
      }, () => {
        expect.fail('non-blocking __QueryComponent should never reject');
      });
      promise.catch(() => {
        expect.fail('non-blocking __QueryComponent should never reject');
      });
      promise.finally(() => {
        expect.fail('non-blocking __QueryComponent should never finally');
      });

      await Promise.resolve();

      expect.assertions(1);
    });
  });

  describe('background thread', () => {
    const QueryComponent = vi.fn();
    const getDynamicComponentExports = vi.fn((data) => ({ data }));

    beforeEach(() => {
      QueryComponent.mockReset();

      vi.unstubAllGlobals()
        .stubGlobal('__LEPUS__', false)
        .stubGlobal('__MAIN_THREAD__', false)
        .stubGlobal('__BACKGROUND__', true)
        .stubGlobal('__JS__', true)
        .stubGlobal('lynx', { QueryComponent })
        .stubGlobal('lynxCoreInject', { tt: { getDynamicComponentExports } });
    });

    test('blocking QueryComponent', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 0, detail: { schema: source } });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
      });

      expect(thenCalled).toBeTruthy();
      expect.assertions(3);
    });

    test('blocking QueryComponent with error', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 1, detail: { errMsg: 'error', source } });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      const promise2 = promise.then(() => {
        expect.fail('promise should reject');
      });
      expect(promise).toBeInstanceOf(Promise);

      let catchCalled = false;
      const promise3 = promise.catch((err) => {
        expect(err).toMatchInlineSnapshot(
          `[Error: Lazy bundle load failed: {"code":1,"detail":{"errMsg":"error","source":"foo"}}]`,
        );
        catchCalled = true;
      });
      expect(catchCalled).toBe(false); // Should be non-blocking

      await expect(promise2).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Lazy bundle load failed: {"code":1,"detail":{"errMsg":"error","source":"foo"}}]`,
      );

      await promise3;
      expect(catchCalled).toBe(true);
    });

    test('blocking QueryComponent with primitive returns', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 0, detail: { schema: source } });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        return 'bar';
      });
      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      const promise3 = promise2.then(data => {
        expect(data).toBe('bar');
        thenCalled = true;
        return 'baz';
      });
      expect(thenCalled).toBe(true);

      thenCalled = false;
      promise3.then(data => {
        expect(data).toBe('baz');
        thenCalled = true;
      });
      expect(thenCalled).toBe(true);
    });

    test('blocking QueryComponent with primitive returns', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 0, detail: { schema: source } });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        return 'bar';
      });
      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      const promise3 = promise2.then(data => {
        expect(data).toBe('bar');
        thenCalled = true;
        return 'baz';
      });
      expect(thenCalled).toBe(true);

      thenCalled = false;
      promise3.then(data => {
        expect(data).toBe('baz');
        thenCalled = true;
      });
      expect(thenCalled).toBe(true);
    });

    test('blocking QueryComponent with thenable returns', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 0, detail: { schema: source } });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        return {
          then(onFulfilled) {
            return onFulfilled('bar');
          },
        };
      });
      expect(thenCalled).toBeTruthy();

      thenCalled = false;
      const promise3 = promise2.then(data => {
        expect(data).toBe('bar');
        thenCalled = true;
        return Promise.resolve('baz');
      });
      expect(thenCalled).toBe(true);

      thenCalled = false;
      promise3.then(data => {
        expect(data).toBe('baz');
        thenCalled = true;
      });
      expect(thenCalled).toBe(false);

      await expect(promise3).resolves.toBe('baz');
    });

    test('blocking QueryComponent with throw in onFulfilled', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 0, detail: { schema: source } });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
        throw new Error('err');
      });

      expect(thenCalled).toBeTruthy();

      await expect(promise2).rejects.toThrow('err');
    });

    test.todo('blocking QueryComponent with onRejected');
    test.todo('blocking QueryComponent with throw in onRejected');

    test('non-blocking QueryComponent', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        Promise.resolve().then(() => {
          callback({ code: 0, detail: { schema: source } });
        });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      const promise2 = promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;

        return 'bar';
      });
      expect(thenCalled).toBe(false);

      await promise;
      expect(thenCalled).toBe(true);

      thenCalled = false;
      promise2.then((data) => {
        expect(data).toBe('bar');
        thenCalled = true;
      });
      expect(thenCalled).toBe(false);

      await expect(promise2).resolves.toBe('bar');
      expect(thenCalled).toBe(true);
    });

    test('non-blocking QueryComponent with rejections', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        Promise.resolve().then(() => {
          callback({ code: 1, detail: { errMsg: 'error', source } });
        });
      });

      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      const promise2 = promise.then(() => {
        expect.fail('promise should not resolve');
      }, (err) => {
        expect(err).toMatchInlineSnapshot(
          `[Error: Lazy bundle load failed: {"code":1,"detail":{"errMsg":"error","source":"foo"}}]`,
        );
        thenCalled = true;
        return 'bar';
      });
      expect(thenCalled).toBe(false);

      await expect(promise).rejects.toMatchInlineSnapshot(
        `[Error: Lazy bundle load failed: {"code":1,"detail":{"errMsg":"error","source":"foo"}}]`,
      );
      expect(thenCalled).toBe(true);

      thenCalled = false;
      promise2.then((data) => {
        expect(data).toBe('bar');
        thenCalled = true;
      });
      expect(thenCalled).toBe(false);

      await expect(promise2).resolves.toBe('bar');
      expect(thenCalled).toBe(true);
    });

    test('lynx.getNativeLynx().QueryComponent', async () => {
      QueryComponent.mockImplementation((source, callback) => {
        callback({ code: 0, detail: { schema: source } });
      });
      vi.stubGlobal('lynx', { getNativeLynx: () => ({ QueryComponent }) });
      const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

      const promise = loadLazyBundle('foo');

      expect(QueryComponent).toBeCalledWith('foo', expect.any(Function));

      let thenCalled = false;
      promise.then(({ data }) => {
        expect(data).toBe('foo');
        thenCalled = true;
      });

      expect(thenCalled).toBeTruthy();
      expect.assertions(3);
    });

    test('GlobalLazyBundleResponseListener', async () => {
      vi.stubGlobal('lynx', {
        queueMicrotask: Promise.prototype.then.bind(Promise.resolve()),
        getNativeLynx: () => ({
          QueryComponent: function(source, callback) {
            callback({
              'code': source === 'Foo' ? 0 : 1601,
              'data': {
                'url': `http://example.com/async/./${source}.jsx.bundle`,
                'sync': false,
                'error_msg': '',
                'mode': 'normal',
              },
              'detail': {
                'schema': `http://example.com/async/./${source}.jsx.bundle`,
                'cache': false,
                'errMsg': '',
              },
            });
          },
        }),
      });
      const scratch = document.createElement('root');
      console.log('scratch', scratch);
      const onResponse = vi.fn();

      const { GlobalLazyBundleResponseListener, loadLazyBundle } = await import('../../src/lynx/lazy-bundle');
      act(() => {
        render(
          <GlobalLazyBundleResponseListener onResponse={onResponse} />,
          scratch,
        );
      });

      loadLazyBundle('Foo');
      expect(loadLazyBundle('Bar')).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Lazy bundle load failed: {"code":1601,"data":{"url":"http://example.com/async/./Bar.jsx.bundle","sync":false,"error_msg":"","mode":"normal"},"detail":{"schema":"http://example.com/async/./Bar.jsx.bundle","cache":false,"errMsg":""}}]`,
      );

      expect(onResponse.mock.calls.length).toBe(2);
      expect(onResponse.mock.calls).toMatchInlineSnapshot(`
        [
          [
            {
              "code": 0,
              "data": {
                "error_msg": "",
                "mode": "normal",
                "sync": false,
                "url": "http://example.com/async/./Foo.jsx.bundle",
              },
              "detail": {
                "cache": false,
                "errMsg": "",
                "schema": "http://example.com/async/./Foo.jsx.bundle",
              },
            },
          ],
          [
            {
              "code": 1601,
              "data": {
                "error_msg": "",
                "mode": "normal",
                "sync": false,
                "url": "http://example.com/async/./Bar.jsx.bundle",
              },
              "detail": {
                "cache": false,
                "errMsg": "",
                "schema": "http://example.com/async/./Bar.jsx.bundle",
              },
            },
          ],
        ]
      `);

      render(
        null,
        scratch,
      );
      loadLazyBundle('Foo');
      expect(onResponse.mock.calls.length).toBe(2);

      expect(
        () => {
          act(() => {
            render(
              <>
                <GlobalLazyBundleResponseListener onResponse={onResponse} />
                <GlobalLazyBundleResponseListener onResponse={onResponse} />
              </>,
              scratch,
            );
          });
        },
      ).toThrowErrorMatchingInlineSnapshot(
        `[Error: <GlobalLazyBundleResponseListener /> can only be used once in the whole page]`,
      );
    });
  });

  test('unreachable', async () => {
    vi
      .stubGlobal('__JS__', false)
      .stubGlobal('__BACKGROUND__', false)
      .stubGlobal('__MAIN_THREAD__', false)
      .stubGlobal('__LEPUS__', false);

    const { loadLazyBundle } = await import('../../src/lynx/lazy-bundle');

    expect(() => loadLazyBundle()).toThrowErrorMatchingInlineSnapshot(`[Error: unreachable]`);
  });
});
