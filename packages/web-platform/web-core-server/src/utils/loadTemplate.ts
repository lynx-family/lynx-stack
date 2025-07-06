import { generateTemplate, type LynxTemplate } from '@lynx-js/web-constants';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

const templateCache: Map<LynxTemplate, LynxTemplate> = new Map();
// Initialize tmpDir with the prefix
let tmpDir: string | undefined;
// Update tmpDir with the actual path of the created temporary directory
const tmpDirPromise = fs.mkdtemp(path.join(os.tmpdir(), 'lynx'));

async function createJsModuleUrl(content: string, filename: string) {
  if (!tmpDir) {
    tmpDir = await tmpDirPromise;
  }
  const fileUrl = path.join(tmpDir, filename);
  await fs.writeFile(fileUrl, content, { flag: 'w+' });
  return fileUrl;
}

export async function loadTemplate(
  rawTemplate: LynxTemplate,
  templateName: string = Math.random().toString(36).substring(2, 7),
): Promise<LynxTemplate> {
  if (templateCache.has(rawTemplate)) {
    return templateCache.get(rawTemplate)!;
  }
  templateName += Math.random().toString(36).substring(2, 7);
  const decodedTemplate: LynxTemplate = templateCache.get(rawTemplate)
    ?? await generateTemplate(
      rawTemplate,
      createJsModuleUrl,
      templateName + '-lepusCode',
    );
  templateCache.set(rawTemplate, decodedTemplate);
  /**
   * This will cause a memory leak, which is expected.
   * We cannot ensure that the `URL.createObjectURL` created url will never be used, therefore here we keep it for the entire lifetime of this page.
   */
  return decodedTemplate;
}
