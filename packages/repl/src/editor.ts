import * as monaco from 'monaco-editor';
import lynxElementApi from '@lynx-js/type-element-api/types/element-api.d.ts?raw';
import lynxTypesMap from './generated/lynx-types-map.json';

// Configure Monaco workers
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(
        new URL(
          'monaco-editor/esm/vs/language/typescript/ts.worker.js',
          import.meta.url,
        ),
        { type: 'module' },
      );
    }
    if (label === 'css') {
      return new Worker(
        new URL(
          'monaco-editor/esm/vs/language/css/css.worker.js',
          import.meta.url,
        ),
        { type: 'module' },
      );
    }
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' },
    );
  },
};

export interface EditorInstance {
  getCode(): { background: string; mainThread: string; css: string };
  setCode(
    defaults: { background: string; mainThread: string; css: string },
  ): void;
  setDarkMode(dark: boolean): void;
  dispose(): void;
}

const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  theme: 'vs-dark',
  fontSize: 13,
  lineNumbers: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 4 },
};

export function createEditor(
  containers: {
    mainThread: HTMLElement;
    background: HTMLElement;
    css: HTMLElement;
  },
  defaults: { background: string; mainThread: string; css: string },
  onChange: () => void,
): EditorInstance {
  // Inject Lynx Element PAPI types from @lynx-js/type-element-api
  // so users get autocomplete + hover docs in the editor
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    lynxElementApi,
    'file:///lynx-globals.d.ts',
  );

  // Inject @lynx-js/types for lynx namespace, events, SystemInfo, etc.
  // Each file is registered with a virtual path matching the package structure
  // so that TypeScript can resolve internal imports between them.
  for (const [filePath, content] of Object.entries(lynxTypesMap)) {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(
      content,
      `file:///${filePath}`,
    );
  }

  const mainThreadModel = monaco.editor.createModel(
    defaults.mainThread,
    'javascript',
    monaco.Uri.parse('file:///main-thread.js'),
  );

  const backgroundModel = monaco.editor.createModel(
    defaults.background,
    'javascript',
    monaco.Uri.parse('file:///background.js'),
  );

  const cssModel = monaco.editor.createModel(
    defaults.css,
    'css',
    monaco.Uri.parse('file:///index.css'),
  );

  const mainThreadEditor = monaco.editor.create(containers.mainThread, {
    ...EDITOR_OPTIONS,
    model: mainThreadModel,
  });

  const backgroundEditor = monaco.editor.create(containers.background, {
    ...EDITOR_OPTIONS,
    model: backgroundModel,
  });

  const cssEditor = monaco.editor.create(containers.css, {
    ...EDITOR_OPTIONS,
    model: cssModel,
  });

  mainThreadModel.onDidChangeContent(() => onChange());
  backgroundModel.onDidChangeContent(() => onChange());
  cssModel.onDidChangeContent(() => onChange());

  return {
    getCode() {
      return {
        background: backgroundModel.getValue(),
        mainThread: mainThreadModel.getValue(),
        css: cssModel.getValue(),
      };
    },

    setCode(newDefaults) {
      mainThreadModel.setValue(newDefaults.mainThread);
      backgroundModel.setValue(newDefaults.background);
      cssModel.setValue(newDefaults.css);
    },

    setDarkMode(dark: boolean) {
      monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
    },

    dispose() {
      mainThreadEditor.dispose();
      backgroundEditor.dispose();
      cssEditor.dispose();
      mainThreadModel.dispose();
      backgroundModel.dispose();
      cssModel.dispose();
    },
  };
}
