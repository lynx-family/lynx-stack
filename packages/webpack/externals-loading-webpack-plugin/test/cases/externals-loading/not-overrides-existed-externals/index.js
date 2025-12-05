import lodash from 'lodash';
import x from 'foo';

console.info(lodash);
console.info(x);

it('should external lodash and foo', async () => {
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

  expect(background).toContain('module.exports ' + '= Lodash;');
  expect(mainThread).toContain('module.exports ' + '= Lodash;');
  expect(background).toContain(
    'module.exports ' + '= __webpack_require__.lynx_ex["Foo"];',
  );
  expect(mainThread).toContain(
    'module.exports ' + '= __webpack_require__.lynx_ex["Foo"];',
  );
});
