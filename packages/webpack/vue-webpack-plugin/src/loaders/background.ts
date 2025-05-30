import { parse } from 'vue/compiler-sfc';
import type { LoaderContext } from '@rspack/core';

export default function (this: LoaderContext, content: string) {
  const { descriptor } = parse(content);
  
  // Extract regular <script>
  const script = descriptor.script?.content || '';

  // @ts-ignore
  this.callback(null, script, descriptor.script?.map);
}
