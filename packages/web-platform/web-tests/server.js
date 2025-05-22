import { createLynxView } from '@lynx-js/web-core-server';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function loadTemplate(caseName) {
  return JSON.parse(
    await readFile(
      path.join(__dirname, 'dist', 'ssr', caseName, 'index.web.json'),
      'utf-8',
    ),
  );
}
export async function SSR(rawTemplate, caseName, projectName = 'fp-only') {
  const lynxView = await createLynxView({
    browserConfig: {
      pixelRatio: 1,
      pixelHeight: 800,
      pixelWidth: 375,
    },
    tagMap: {},
    initData: { mockData: 'mockData' },
    globalProps: {},
    template: rawTemplate,
    templateName: caseName,
    hydrateUrl: `/dist/${caseName}/index.web.json`,
    injectStyles: `@import url("/${projectName}.css");`,
    autoSize: true,
    lynxViewStyle: 'width:100vw; max-width: 500px;',
  });
  const ssrHtml = await lynxView.renderToString();
  return ssrHtml;
}
export async function genTemplate(caseName, projectName = 'fp-only') {
  const ssrHtml = await SSR(
    await loadTemplate(caseName),
    caseName,
    projectName,
  );
  return ssrHtml;
}
export async function genHtml(originalHTML, caseName, projectName) {
  const ssrHtml = await genTemplate(caseName, projectName);

  return originalHTML.replace(
    '<body>',
    '<body>' + ssrHtml,
  );
}
