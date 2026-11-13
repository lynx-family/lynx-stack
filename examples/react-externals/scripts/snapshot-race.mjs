import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(
  new URL(
    '../../../packages/web-platform/web-core-e2e/package.json',
    import.meta.url,
  ),
);
const { default: playwright } = await import(
  pathToFileURL(require.resolve('@playwright/test')).href
);
const { chromium } = playwright;
const port = Number(process.env.PORT ?? 3307);
const output = process.env.REACTLYNX_ASYNC === 'true'
  ? 'dist-react-async'
  : 'dist';
const messages = [];
const errors = [];
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://localhost:${port}`).pathname;
  if (pathname === '/') {
    response.setHeader('content-type', 'text/html');
    response.end(
      `<!doctype html><link rel="stylesheet" href="/repo/packages/web-platform/web-core/dist/client_prod/static/css/client.css">
<script type="module">
import '/repo/packages/web-platform/web-core/dist/client_prod/static/js/client.js';
const view = document.createElement('lynx-view');
view.setAttribute('height', 'auto');
view.initData = {};
view.globalProps = {};
view.addEventListener('error', event => console.error('lynx-view error', JSON.stringify(event.detail)));
document.body.append(view);
view.setAttribute('url', '/main.web.bundle');
</script>`,
    );
    return;
  }
  const file = pathname.startsWith('/repo/')
    ? path.join(root, pathname.slice(6))
    : path.join(root, 'examples/react-externals', output, pathname.slice(1));
  const contentTypes = {
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.wasm': 'application/wasm',
    '.json': 'application/json',
  };
  response.setHeader(
    'content-type',
    contentTypes[path.extname(file)] ?? 'application/octet-stream',
  );
  try {
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end(file);
  }
});
await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
if (process.env.SERVE_ONLY === 'true') {
  console.info(`Serving ${output} at http://127.0.0.1:${port}`);
  await new Promise(() => {
    // Keep serving until the diagnostic process is stopped.
  });
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on(
    'console',
    message => messages.push({ type: message.type(), text: message.text() }),
  );
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.waitForTimeout(5000);
  const text = await page.locator('body').innerText();
  const rendered = await page.getByText('Tap the logo and have fun!', {
    exact: true,
  }).count();
  console.info(
    JSON.stringify({ output, text, rendered, messages, errors }, null, 2),
  );
  assert(
    messages.some(message =>
      message.text.includes('delaying main-thread evaluation')
    ),
    'The main-thread delay did not run',
  );
  const snapshotError = messages.some(message =>
    message.text.includes('Snapshot not found')
  );
  assert.equal(
    snapshotError,
    process.env.EXPECT_SNAPSHOT_ERROR === 'true',
    'Unexpected snapshot result',
  );
  if (snapshotError) {
    assert(
      messages.some(message =>
        message.text.includes('first-screen children=0')
      ),
      'Expected an empty first screen',
    );
    assert(
      messages.some(message => message.text.includes('"isHydration":true')),
      'Expected a hydration patch',
    );
  } else {
    assert.equal(
      rendered,
      1,
      'The component should render after its main-thread section loads',
    );
    assert.deepEqual(errors, []);
    const evaluation = messages.findIndex(message =>
      message.text.includes('comp-lib main-thread evaluation starts')
    );
    const firstScreen = messages.findIndex(message =>
      message.text.includes('first-screen children=')
    );
    assert(
      firstScreen > evaluation,
      'First-screen handover must wait for main-thread component evaluation',
    );
    assert(
      !messages.some(message =>
        message.text.includes('first-screen children=0')
      ),
      'The host must not hand over an empty first screen',
    );
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
