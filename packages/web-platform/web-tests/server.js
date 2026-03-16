import { executeTemplate } from '@lynx-js/web-core/server';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export async function loadTemplate(caseName) {
  return await readFile(
    path.join(__dirname, 'dist', 'ssr', caseName, 'index.web.json'),
  );
}
export async function SSR(rawTemplate, caseName, projectName = 'fp-only') {
  const ssrHtml = executeTemplate(
    rawTemplate,
    { mockData: 'mockData' },
    {},
    [],
  );
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
