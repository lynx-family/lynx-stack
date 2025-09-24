import { test, expect, beforeAll } from 'vitest';
import { createRsbuild, type RsbuildDevServer } from '@rsbuild/core';
import { createWebVirtualFilesMiddleware } from '../src/node/index.js';

let rsbuildServer!: RsbuildDevServer;
let port!: number;

beforeAll(async () => {
  const rsbuild = await createRsbuild();
  rsbuildServer = await rsbuild.createDevServer({ runCompile: false });
  rsbuildServer.middlewares.use(createWebVirtualFilesMiddleware('/web'));
  port = (await rsbuildServer.listen()).port;

  return async () => {
    await rsbuildServer.close();
  };
});

const GET = async (path: string) => {
  // Make an HTTP request over the IPC socket
  const result = await fetch(`http://localhost:${port}/${path}`);
  if (result.status !== 200) {
    throw new Error(`Request failed with status ${result.status}`);
  }
  return result;
};
test('web root', async () => {
  const body = await (await GET('/web')).text();

  expect(body.toLowerCase().startsWith('<!doctype html>')).toBe(true);
  // Add more assertions as needed
});

test('web/ root', async () => {
  const body = await (await GET('/web/')).text();

  expect(body.toLowerCase().startsWith('<!doctype html>')).toBe(true);
  // Add more assertions as needed
});

test('web/index.html', async () => {
  const body = await (await GET('/web/index.html')).text();

  expect(body.toLowerCase().startsWith('<!doctype html>')).toBe(true);
  // Add more assertions as needed
});

test('web/index.js', async () => {
  const response = await GET('/web/static/js/index.js');
  expect(response.headers.get('Content-Type')).toBe(
    'application/javascript; charset=utf-8',
  );
});

test('with get query', async () => {
  const body = await (await GET('/web?casename=/examples/basic')).text();

  expect(body.toLowerCase().startsWith('<!doctype html>')).toBe(true);
});
