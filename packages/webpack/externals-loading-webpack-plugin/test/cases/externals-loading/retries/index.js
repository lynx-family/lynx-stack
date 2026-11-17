import x from 'foo';
import y from 'bar';

console.info(x);
console.info(y);

it('should pass retries to createRetryingHandler per fetchBundle', async () => {
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

  expect(background).toMatch(
    /createRetryingHandler\(\(\) => lynx\.fetchBundle\("foo", \{\}\), 5\)/,
  );
  expect(background).toMatch(
    /createRetryingHandler\(\(\) => lynx\.fetchBundle\("bar", \{\}\), 3\)/,
  );
  expect(mainThread).toMatch(
    /createRetryingHandler\(\(\) => lynx\.fetchBundle\("foo", \{\}\), 5\)/,
  );
  expect(mainThread).toMatch(
    /createRetryingHandler\(\(\) => lynx\.fetchBundle\("bar", \{\}\), 3\)/,
  );

  // The load helpers no longer carry retries/fetchBundle parameters.
  expect(background).not.toMatch(/createLoadExternalAsync\([^)]*,[^)]*,[^)]*,/);
  expect(mainThread).not.toMatch(
    /createLoadExternalSync\([^)]*,[^)]*,[^)]*,[^)]*,/,
  );
});
