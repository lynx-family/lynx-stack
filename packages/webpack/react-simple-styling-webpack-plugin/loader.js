// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import generator from '@babel/generator';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { SourceMapConsumer, SourceMapGenerator } from 'source-map';

export default async function simpleStyleLoader(source, inputSourceMap) {
  this.cacheable(false);
  const callback = this.async();
  // Store all style rules
  this._compilation.styleRules ??= [];
  // Store the mapping between original IDs (hash) and array indices
  this._compilation.idToIndexMap ??= new Map();

  const styleRules = this._compilation.styleRules;
  const idToIndexMap = this._compilation.idToIndexMap;

  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    sourceFilename: this.resourcePath,
  });
  let hasChange = false;

  traverse.default(ast, {
    CallExpression: (path) => {
      if (t.isIdentifier(path.node.callee, { name: '__SimpleStyleInject' })) {
        if (path.node.arguments.length !== 3) return;
        const [idArg, propArg, valueArg] = path.node.arguments;
        if (!t.isStringLiteral(idArg)) return;

        const originalId = idArg.value;
        const prop = t.isStringLiteral(propArg)
          ? propArg.value
          : (t.isIdentifier(propArg)
            ? propArg.name
            : undefined);
        const value = t.isStringLiteral(valueArg)
          ? valueArg.value
          : (t.isIdentifier(valueArg)
            ? valueArg.name
            : undefined);

        const existingIndex = (prop && value)
          ? styleRules.findIndex(
            ([p, v]) => p === prop && v === value,
          )
          : -1;

        const newIndex = existingIndex === -1
          ? styleRules.length
          : existingIndex;

        if (existingIndex === -1) {
          if (prop && value) {
            styleRules.push([prop, value]);
          } else {
            styleRules.push([]);
          }
        }

        idToIndexMap.set(originalId, newIndex);

        path.remove();
        hasChange = true;
      }
    },
    ArrayExpression: (path) => {
      path.node.elements.forEach((el, index) => {
        if (t.isStringLiteral(el)) {
          const ref = el.value;
          if (idToIndexMap.has(ref)) {
            path.node.elements[index] = t.numericLiteral(idToIndexMap.get(ref));
            hasChange = true;
          }
        }
      });
    },
  });

  if (hasChange) {
    const generated = generator.default(ast, {
      sourceMaps: true,
      sourceFileName: this.resourcePath,
    });

    const mergeSourceMaps = async () => {
      if (!inputSourceMap) return generated.map;

      const currentConsumer = await new SourceMapConsumer(generated.map);
      const upstreamConsumer = await new SourceMapConsumer(inputSourceMap);

      const mergedGenerator = new SourceMapGenerator();

      currentConsumer.eachMapping(mapping => {
        const original = upstreamConsumer.originalPositionFor({
          line: mapping.originalLine,
          column: mapping.originalColumn,
        });

        if (original.source !== null) {
          mergedGenerator.addMapping({
            generated: {
              line: mapping.generatedLine,
              column: mapping.generatedColumn,
            },
            original: {
              line: original.line,
              column: original.column,
            },
            source: original.source,
            name: original.name,
          });
        }
      });

      currentConsumer.sources.forEach(sourceFile => {
        mergedGenerator.setSourceContent(
          sourceFile,
          upstreamConsumer.sourceContentFor(sourceFile),
        );
      });

      return mergedGenerator.toJSON();
    };

    callback(null, generated.code, await mergeSourceMaps());
    return;
  }

  callback(null, source, inputSourceMap);
}
