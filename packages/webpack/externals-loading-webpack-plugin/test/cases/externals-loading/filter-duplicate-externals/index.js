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
      `lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]["Foo"]`
        + ' = createLoadExternalSync(',
    ).length - 1,
  ).toBe(1);
  expect(
    mainThread.split(
      `lynx[Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]["Foo"] `
        + '= createLoadExternalSync(',
    ).length - 1,
  ).toBe(1);
});
