import { describe } from 'vitest';

describe('lynx global API', () => {
  it('getJSModule should work', () => {
    const cb = vi.fn();
    lynx.getJSModule('GlobalEventEmitter')
      .addListener('onDataChanged', cb);

    lynx.getJSModule('GlobalEventEmitter').emit('onDataChanged', {
      data: {
        foo: 'bar',
      },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls).toMatchInlineSnapshot(`
      [
        [
          {
            "data": {
              "foo": "bar",
            },
          },
        ],
      ]
    `);
  });
});
