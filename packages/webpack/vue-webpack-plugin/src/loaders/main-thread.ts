import { parse } from 'vue/compiler-sfc';
import type { LoaderContext } from '@rspack/core';

export default function (this: LoaderContext, content: string) {
  const { descriptor } = parse(content);
  
  // Extract <template> and <script main>
  const template = descriptor.template?.content || '';
  const mainScript = descriptor.customBlocks.find(b => b.type === 'script' && b.attrs['main'])?.content || '';
  
  this.callback(
    null,
    `${mainScript}\n;export default { template: \`${template}\` }`,
    // @ts-ignore
    descriptor.template?.map // Forward sourcemap if needed
  );
}
