import { add } from 'foo';
import { minus } from 'bar';
import { mul } from 'baz/sub1';
import { div } from 'baz/sub2';
import { exp } from 'qux';

console.info(add(1, 2));
console.info(minus(1, 2));
console.info(mul(2, 3));
console.info(div(6, 2));
console.info(exp(2, 3));

it('should merge fetchBundle calls', async () => {
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

  const backgroundFetchBundleCalls = background.split('fetchBundle' + '(');
  const mainThreadFetchBundleCalls = mainThread.split('fetchBundle' + '(');
  expect(backgroundFetchBundleCalls.length).toBe(2);
  expect(mainThreadFetchBundleCalls.length).toBe(2);
});
