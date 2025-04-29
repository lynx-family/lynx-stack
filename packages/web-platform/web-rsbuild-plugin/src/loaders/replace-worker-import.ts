export default function(source: string) {
  const modifiedSource = source.replace(
    /\/\* WORKER_IMPORT_ADD \*\//,
    `import LynxWorker from '@lynx-js/web-worker-runtime';`,
  ).replace(
    /\/\* WORKER_IMPORT_REPLACE \*\/[\s\S]*?\/\* WORKER_IMPORT_REPLACE \*\//g,
    `return LynxWorker({
    type: 'module',
    name,
  });`,
  );

  return modifiedSource;
}
