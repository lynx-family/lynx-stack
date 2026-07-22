// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createParser } from '@openuidev/lang-core';

import { createOpenUiPromptLibrary } from '../dist/openui-prompt/index.js';

const packageDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const genuiDir = path.dirname(packageDir);
const skillDir = path.join(packageDir, 'skills', 'lynx-openui');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readDocumentedSignatures(markdown) {
  const signatures = new Map();
  for (
    const match of markdown.matchAll(
      /^- `([A-Z][A-Za-z0-9]*\([^`\r\n]*\))`\r?$/gmu,
    )
  ) {
    const signature = match[1];
    const name = signature.slice(0, signature.indexOf('('));
    assert.ok(!signatures.has(name), `Duplicate component signature: ${name}`);
    signatures.set(name, signature);
  }
  return signatures;
}

const skill = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
assert.match(skill, /^---\nname: lynx-openui\n/u);
for (const reference of ['components.md', 'runtime.md', 'examples.md']) {
  assert.ok(
    fs.existsSync(path.join(skillDir, 'references', reference)),
    `Missing skill reference: ${reference}`,
  );
}

const library = createOpenUiPromptLibrary();
const librarySchema = library.toJSONSchema();
const componentReference = fs.readFileSync(
  path.join(skillDir, 'references', 'components.md'),
  'utf8',
);
const documentedSignatures = readDocumentedSignatures(componentReference);
const expectedComponents = library.toSpec().components;
assert.deepEqual(
  [...documentedSignatures.keys()].sort(),
  Object.keys(expectedComponents).sort(),
  'Skill component names must match the headless OpenUI prompt library',
);
for (const [name, component] of Object.entries(expectedComponents)) {
  assert.equal(
    documentedSignatures.get(name),
    component.signature,
    `Skill signature for ${name} must match the prompt library`,
  );
}

const schemaHashMatch = componentReference.match(
  /<!-- catalog-json-schema-sha256: ([a-f0-9]{64}) -->/u,
);
assert.ok(schemaHashMatch, 'Missing catalog JSON schema hash');
const schemaHash = createHash('sha256')
  .update(JSON.stringify(librarySchema.$defs ?? {}))
  .digest('hex');
assert.equal(
  schemaHashMatch[1],
  schemaHash,
  `Catalog alias types changed; review components.md and update its schema hash to ${schemaHash}`,
);

const exampleReference = fs.readFileSync(
  path.join(skillDir, 'references', 'examples.md'),
  'utf8',
);
const examples = [
  ...exampleReference.matchAll(/```openui\r?\n([\s\S]*?)\r?\n```/gu),
].map((match) => match[1].trim());
assert.ok(examples.length > 0, 'Expected at least one OpenUI example');

for (const [index, example] of examples.entries()) {
  assert.match(
    example,
    /^root = Stack\(/u,
    `Example ${index + 1} must start with root = Stack(...)`,
  );
  const result = createParser(
    librarySchema,
    library.root,
  ).parse(example);
  assert.ok(result.root, `Example ${index + 1} did not produce a root`);
  assert.equal(
    result.meta.incomplete,
    false,
    `Example ${index + 1} incomplete`,
  );
  assert.deepEqual(
    result.meta.unresolved,
    [],
    `Example ${index + 1} has unresolved references`,
  );
  assert.deepEqual(
    result.meta.orphaned,
    [],
    `Example ${index + 1} has orphaned statements`,
  );
  assert.deepEqual(
    result.meta.errors,
    [],
    `Example ${index + 1} has validation errors`,
  );
}

const openuiPackage = readJson(path.join(packageDir, 'package.json'));
assert.equal(
  openuiPackage.exports['./skill'],
  './skills/lynx-openui/SKILL.md',
);
assert.ok(openuiPackage.files.includes('skills'));

const publicPackage = readJson(path.join(genuiDir, 'package.json'));
const publicSkillPath = './openui/skills/lynx-openui/SKILL.md';
assert.equal(publicPackage.exports['./openui/skill'], publicSkillPath);
assert.ok(publicPackage.files.includes('openui/skills'));
assert.ok(fs.existsSync(path.resolve(genuiDir, publicSkillPath)));

console.log(`Validated Lynx OpenUI skill (${examples.length} examples).`);
