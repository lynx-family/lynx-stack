import x from 'foo';
import y from 'bar';
import z from 'baz';

console.info(x);
console.info(y);
console.info(z);

it('should use max retries across externals sharing the same bundle URL', async () => {
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

  for (const code of [background, mainThread]) {
    const createCalls = code.match(
      /createRetryingHandler\(\(\) => lynx\.fetchBundle\("shared\.bundle", \{\}\), (\d+)\)/g,
    );
    expect(createCalls).not.toBeNull();
    expect(createCalls.length).toBe(1);
    expect(createCalls[0]).toMatch(/, 7\)$/);
  }
});
