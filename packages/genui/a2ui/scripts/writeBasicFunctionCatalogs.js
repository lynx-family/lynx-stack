// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const outDir = path.resolve(process.argv[2] ?? 'dist');
const catalogJsonPath = path.resolve(
  process.argv[3] ?? path.join(outDir, 'catalog.json'),
);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const functionsModulePath = path.join(packageDir, 'dist/functions/index.js');

if (!fs.existsSync(functionsModulePath)) {
  throw new Error(
    `[a2ui] Missing ${functionsModulePath}. Run \`tsc --project tsconfig.build.json\` before writing basic function catalogs.`,
  );
}

const { basicFunctions } = await import(
  pathToFileURL(functionsModulePath).href
);
const functions = basicFunctions
  .map((entry) => entry.definition)
  .filter(Boolean);
const functionSchemas = Object.fromEntries(
  functions.map(({ description, name, parameters, returnType }) => [
    name,
    {
      type: 'object',
      ...(description ? { description } : {}),
      returnType,
      allowedCallers: 'rendererOnly',
      properties: {
        call: { const: name },
        args: stripSchemaDialect(parameters),
      },
      required: ['call', 'args'],
    },
  ]),
);

const legacyCatalogJsonPath = path.join(outDir, 'catalog', 'catalog.json');
if (
  legacyCatalogJsonPath !== catalogJsonPath
  && fs.existsSync(legacyCatalogJsonPath)
) {
  fs.unlinkSync(legacyCatalogJsonPath);
}

fs.rmSync(path.join(outDir, 'catalog', 'functions'), {
  recursive: true,
  force: true,
});

if (fs.existsSync(catalogJsonPath)) {
  const catalog = JSON.parse(fs.readFileSync(catalogJsonPath, 'utf8'));
  catalog.functions = functionSchemas;
  catalog.$defs.anyFunction = {
    oneOf: Object.keys(functionSchemas).map(name => ({
      $ref: `#/functions/${name}`,
    })),
  };
  fs.writeFileSync(catalogJsonPath, `${JSON.stringify(catalog, null, 2)}\n`);
}

function stripSchemaDialect(schema) {
  const rest = { ...schema };
  delete rest.$schema;
  return rest;
}
