import mul from 'baz/sub1/mul';
import add from 'foo';

const consoleInfoMock = rstest.spyOn(console, 'info').mockImplementation(() =>
  undefined
);

console.info(add(1, 2));
console.info(mul(3, 4));

it('should resolve subpath exports after the namespace promise resolves', async () => {
  expect(consoleInfoMock).toBeCalledTimes(2);
  expect(consoleInfoMock).toHaveBeenNthCalledWith(1, 3);
  expect(consoleInfoMock).toHaveBeenNthCalledWith(2, 12);

  const fs = await import('node:fs');
  const path = await import('node:path');

  const background = fs.readFileSync(
    path.resolve(__dirname, 'main:background.js'),
    'utf-8',
  );

  // Use concatenation to avoid the literal pattern appearing inside this compiled file itself.

  // The external module must await the mounted namespace promise before
  // picking the subpath. A synchronous array lookup would read `.add` off the
  // pending promise and export undefined.
  const promiseExternal = 'Promise.resolve' + '(lynx[Symbol.for(';
  expect(background).toContain(promiseExternal);
  expect(background).toContain('return m' + '["add"]');
  // Multi-level subpath: ALL segments after the mount key are picked inside
  // the then callback, not just the first one.
  expect(background).toContain('return m' + '["Sub1"]["mul"]');
  expect(background).not.toContain(']["FooLib"]' + '["add"]');
  expect(background).not.toContain(']["Baz"]' + '["Sub1"]');
});
