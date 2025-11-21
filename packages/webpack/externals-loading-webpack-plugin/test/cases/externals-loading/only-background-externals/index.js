import { add } from 'mock-module';

const consoleInfoMock = vi.spyOn(console, 'info').mockImplementation(() =>
  undefined
);

console.info(add(1, 2));

it('should log 3', async () => {
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

  expect(background).not.toContain('add' + '(a, b)');
  expect(mainThread).toContain('add' + '(a, b)');

  expect(consoleInfoMock).toBeCalledTimes(1);
  expect(consoleInfoMock).toBeCalledWith(3);
});
