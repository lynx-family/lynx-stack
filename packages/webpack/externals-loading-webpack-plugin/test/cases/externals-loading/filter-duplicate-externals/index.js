import x from 'mock-module';

console.info(x);

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
      '__webpack_require__.lynx_ex["MockModule"] '
        + '= createLoadExternalSync(',
    ).length - 1,
  ).toBe(1);
  expect(
    mainThread.split(
      '__webpack_require__.lynx_ex["MockModule"] '
        + '= createLoadExternalSync(',
    ).length - 1,
  ).toBe(1);
});
