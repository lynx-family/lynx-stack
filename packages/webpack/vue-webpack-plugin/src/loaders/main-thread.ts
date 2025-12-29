import { createHash } from 'node:crypto';

import type { LoaderContext } from '@rspack/core';
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc';

const hashId = (filename: string): string => {
  return createHash('sha256').update(filename).digest('hex').slice(0, 8);
};

export default function (this: LoaderContext, content: string) {
  const filename = this.resourcePath;
  const id = hashId(filename);
  const { descriptor } = parse(content, { filename });

  const script = descriptor.script || descriptor.scriptSetup
    ? compileScript(descriptor, { id })
    : null;

  const hasTemplate = !!descriptor.template;
  let map: any;

  let code = '';
  if (hasTemplate && descriptor.template) {
    const templateResult = compileTemplate({
      id,
      filename,
      source: descriptor.template.content,
      compilerOptions: {
        bindingMetadata: script?.bindings,
        mode: 'function',
      },
    });

    if (templateResult.errors?.length) {
      this.callback(templateResult.errors[0] as Error);
      return;
    }

    map = templateResult.map;
    code += `${templateResult.code}\n`;
  }

  const componentCode = script
    ? script.content.replace(/export\s+default/, 'const __sfc__ =')
    : 'const __sfc__ = {};';

  code += `${componentCode}\n`;
  if (hasTemplate) {
    code += '__sfc__.render = render;\n';
  }
  code += 'export default __sfc__;\n';

  this.callback(null, code, map);
}
