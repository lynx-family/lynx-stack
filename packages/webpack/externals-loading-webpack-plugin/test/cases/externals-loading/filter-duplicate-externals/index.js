import x from 'foo';
import x2 from 'foo2';

console.info(x);
console.info(x2);

it('should filter duplicate externals', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');

  const background = fs.readFileSync(
    path.resolve(__dirname, 'main:background.js'),
    'utf-8',
  );
  const mainThread = fs.readFileSync(
    path.resolve(__dirname, 'main:main-thread.js'),
    'utf-8',
  );
  expect(
    background.split(
      'lynxCoreInject.tt.lynx_ex["Foo"] '
        + '= createLoadExternalSync(',
    ).length - 1,
  ).toBe(1);
  expect(
    mainThread.split(
      'globalThis.lynx_ex["Foo"] '
        + '= createLoadExternalSync(',
    ).length - 1,
  ).toBe(1);
});
