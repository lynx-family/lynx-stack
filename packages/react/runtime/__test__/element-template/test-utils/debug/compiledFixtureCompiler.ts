import fs from 'node:fs';
import path from 'node:path';

export type CompiledFixtureTarget = 'LEPUS' | 'JS' | 'MIXED';

interface TransformResult {
  code?: string;
  elementTemplates?: unknown[];
}

export interface CompiledFixtureArtifact {
  code: string;
  elementTemplates: unknown[];
  filename: string;
  sourcePath: string;
  target: CompiledFixtureTarget;
}

interface CompileFixtureSourceOptions {
  enableWorkletTransform?: boolean;
  isDynamicComponent?: boolean;
  target?: CompiledFixtureTarget;
}

function toFixtureFilename(sourcePath: string): string {
  return path.relative(process.cwd(), sourcePath).split(path.sep).join('/');
}

export async function compileFixtureSource(
  sourcePath: string,
  options: CompileFixtureSourceOptions = {},
): Promise<CompiledFixtureArtifact> {
  const { enableWorkletTransform = false, isDynamicComponent = false, target = 'LEPUS' } = options;
  const code = fs.readFileSync(sourcePath, 'utf8');
  const filename = toFixtureFilename(sourcePath);
  const { transformReactLynx } = await import('@lynx-js/react-transform');
  const result = (await transformReactLynx(code, {
    mode: 'test',
    pluginName: 'test-plugin',
    // Keep fixture-relative paths stable for source metadata. Template ids are
    // content-addressed from the compiled Template Definition.
    filename,
    sourcemap: false,
    cssScope: false,
    elementTemplate: {
      preserveJsx: false,
      runtimePkg: '@lynx-js/react/element-template/internal',
      filename,
      isDynamicComponent,
      target,
    },
    shake: false,
    compat: true,
    directiveDCE: false,
    defineDCE: false,
    worklet: enableWorkletTransform
      ? {
        filename,
        runtimePkg: '@lynx-js/react/internal',
        target,
      }
      : false,
    refresh: false,
  })) as TransformResult;

  return {
    code: (result.code ?? '').replace(
      /from ["']react\/jsx-runtime["']/g,
      'from "@lynx-js/react/jsx-runtime"',
    ),
    elementTemplates: result.elementTemplates ?? [],
    filename,
    sourcePath,
    target,
  };
}
