import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(BASE_DIR, 'src/catalog');
const DIST_CATALOG_DIR = path.join(BASE_DIR, 'dist/catalog');

// These props belong to the framework/generic component layer, not the schema.
const GENERIC_PROPS = new Set([
  'id',
  'surface',
  'setValue',
  'sendAction',
  'dataContextPath',
  '__template',
  'component',
]);

function getComponentIndexFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      const indexFile = path.join(filePath, 'index.tsx');
      if (fs.existsSync(indexFile)) {
        results.push(indexFile);
      }
    }
  }
  return results;
}

function parseType(type: ts.Type, checker: ts.TypeChecker): any {
  if (
    type.flags & ts.TypeFlags.Boolean
    || type.flags & ts.TypeFlags.BooleanLiteral
  ) return { type: 'boolean' };
  if (type.flags & ts.TypeFlags.StringLiteral) return { type: 'string' };
  if (type.flags & ts.TypeFlags.NumberLiteral) return { type: 'number' };

  if (type.isUnion()) {
    // Filter out undefined and null from the union
    const actualTypes = type.types.filter(t =>
      !(t.flags & ts.TypeFlags.Undefined) && !(t.flags & ts.TypeFlags.Null)
    );

    // Check if union inherently represents a strict boolean type (true | false) globally
    if (
      actualTypes.length === 2
      && actualTypes.some(t => (t as any).intrinsicName === 'true')
      && actualTypes.some(t => (t as any).intrinsicName === 'false')
    ) {
      return { type: 'boolean' };
    }

    if (actualTypes.length === 1) {
      return parseType(actualTypes[0], checker);
    }

    // Check if it's a union of string literals (Enum)
    const isEnum = actualTypes.every(t => t.isStringLiteral());
    if (isEnum && actualTypes.length > 0) {
      return {
        type: 'string',
        enum: actualTypes.map(t => (t as ts.StringLiteralType).value),
      };
    }

    const schemas = actualTypes.map(t => parseType(t, checker));
    // Deduplicate exact schemas (merges split booleans inside wider unions)
    const deduplicated = [];
    for (const schema of schemas) {
      if (
        !deduplicated.some(d => JSON.stringify(d) === JSON.stringify(schema))
      ) {
        deduplicated.push(schema);
      }
    }

    // Check if after deduplication we only have 1
    if (deduplicated.length === 1) return deduplicated[0];

    return { oneOf: deduplicated };
  }

  if (type.flags & ts.TypeFlags.String) return { type: 'string' };
  if (type.flags & ts.TypeFlags.Number) return { type: 'number' };
  if (type.flags & ts.TypeFlags.Boolean) return { type: 'boolean' };

  if (checker.isArrayType(type)) {
    const elemType = type.getNumberIndexType()
      || (type as any).resolvedTypeArguments?.[0];
    return {
      type: 'array',
      items: elemType ? parseType(elemType, checker) : { type: 'any' },
    };
  }

  if (type.flags & ts.TypeFlags.Object || type.isClassOrInterface()) {
    const stringIndexType = type.getStringIndexType();
    const props = type.getProperties();

    // If it's pure any or unknown object without props
    if (props.length === 0 && !stringIndexType) {
      return { type: 'object' };
    }

    const schema: any = { type: 'object' };

    if (props.length > 0) {
      schema.properties = {};
      const required = [];
      for (const p of props) {
        // Skip array inherited methods if somehow parsed
        if (p.name === 'length' || p.name === 'push' || p.name === 'filter') {
          continue;
        }

        const decl = p.valueDeclaration || p.declarations?.[0];
        if (!decl) continue;

        const propType = checker.getTypeOfSymbolAtLocation(p, decl);
        const propSchema = parseType(propType, checker);

        const displayParts = p.getDocumentationComment(checker);
        if (displayParts.length > 0) {
          propSchema.description = ts.displayPartsToString(displayParts);
        }

        schema.properties[p.name] = propSchema;

        // Check if optional
        let isOptional = (p.flags & ts.SymbolFlags.Optional) !== 0;
        if (!isOptional && decl && (decl as any).questionToken) {
          isOptional = true;
        }

        // Also check if union contains undefined
        if (
          propType.isUnion()
          && propType.types.some(t => t.flags & ts.TypeFlags.Undefined)
        ) {
          isOptional = true;
        }

        if (!isOptional) {
          required.push(p.name);
        }
      }
      if (required.length >= 0) {
        schema.required = required;
      }

      if (!stringIndexType) {
        schema.additionalProperties = false;
      }
    }

    if (stringIndexType) {
      schema.additionalProperties = parseType(stringIndexType, checker);
    }
    return schema;
  }

  return { type: 'string' }; // Fallback
}

function generateSchema() {
  const indexFiles = getComponentIndexFiles(CATALOG_DIR);
  console.log(`Found ${indexFiles.length} component files`);

  const program = ts.createProgram(indexFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.Preserve,
    strict: true,
  });
  const checker = program.getTypeChecker();

  for (const file of indexFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;

    const componentDir = path.dirname(file);
    const componentName = path.basename(componentDir);

    let baseSchema: any = null;

    function visitNode(node: ts.Node) {
      if (
        ts.isFunctionDeclaration(node) && node.name?.getText() === componentName
      ) {
        if (node.parameters.length > 0) {
          const propsParam = node.parameters[0];
          const propsType = checker.getTypeAtLocation(propsParam);
          baseSchema = processComponentPropsType(propsType, checker);
        }
      }
      ts.forEachChild(node, visitNode);
    }

    function processComponentPropsType(type: ts.Type, checker: ts.TypeChecker) {
      const schema: any = { properties: {} };
      const required = [];
      const props = type.getProperties();

      for (const p of props) {
        const decl = p.valueDeclaration || p.declarations?.[0];
        if (!decl) continue;

        const parentInterface = decl.parent;
        if (
          parentInterface
          && ts.isInterfaceDeclaration(parentInterface)
          && (parentInterface.name.text === 'GenericComponentProps'
            || parentInterface.name.text === 'ComponentProps')
        ) {
          continue;
        }

        const propType = checker.getTypeOfSymbolAtLocation(p, decl);
        const propSchema = parseType(propType, checker);

        const displayParts = p.getDocumentationComment(checker);
        if (displayParts.length > 0) {
          propSchema.description = ts.displayPartsToString(displayParts);
        }

        schema.properties[p.name] = propSchema;

        let isOptional = (p.flags & ts.SymbolFlags.Optional) !== 0;
        if (!isOptional && decl && (decl as any).questionToken) {
          isOptional = true;
        }
        if (
          propType.isUnion()
          && propType.types.some(t => t.flags & ts.TypeFlags.Undefined)
        ) {
          isOptional = true;
        }

        if (!isOptional) {
          required.push(p.name);
        }
      }

      if (required.length >= 0) schema.required = required;
      return schema;
    }

    visitNode(sourceFile);

    if (baseSchema) {
      const outDir = path.join(DIST_CATALOG_DIR, componentName);
      fs.mkdirSync(outDir, { recursive: true });

      const finalSchema = { [componentName]: baseSchema };
      const finalSchemaStr = JSON.stringify(finalSchema, null, 2);

      fs.writeFileSync(
        path.join(outDir, 'catalog.json'),
        finalSchemaStr + '\n',
      );

      console.log(`Generated strict schema for ${componentName}`);
    } else {
      console.warn(`[Warning] Could not resolve schema for ${componentName}`);
    }
  }
}

generateSchema();
