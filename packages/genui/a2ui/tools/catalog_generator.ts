import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(BASE_DIR, 'src/catalog');
const DIST_CATALOG_DIR = path.join(BASE_DIR, 'dist/catalog');

// Generic properties from ComponentRegistry/GenericComponentProps
// We ignore these when generating Component specific schemas since they belong to platform layer.
const GENERIC_PROPS = new Set([
  'id',
  'surface',
  'setValue',
  'sendAction',
  'dataContextPath',
  '__template',
]);

// Identify functional components and extract TS AST props accesses
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

function parseInferredTypes(node: ts.Node, typeChecker: ts.TypeChecker): any {
  if (ts.isAsExpression(node) && node.type) {
    return inferTypeFromNode(node.type);
  }
  if (
    ts.isBinaryExpression(node)
    && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return parseInferredTypes(node.left, typeChecker);
  }
  // Base default structure if it cannot be fully inferred
  return { type: 'string' };
}

function inferTypeFromNode(typeNode: ts.TypeNode): any {
  if (typeNode.kind === ts.SyntaxKind.StringKeyword) return { type: 'string' };
  if (typeNode.kind === ts.SyntaxKind.BooleanKeyword) {
    return { type: 'boolean' };
  }
  if (typeNode.kind === ts.SyntaxKind.NumberKeyword) return { type: 'number' };

  if (ts.isUnionTypeNode(typeNode)) {
    let hasString = false;
    let hasBoolean = false;
    typeNode.types.forEach(t => {
      if (t.kind === ts.SyntaxKind.StringKeyword) hasString = true;
      if (t.kind === ts.SyntaxKind.BooleanKeyword) hasBoolean = true;
    });
    if (hasBoolean) return { type: 'boolean' };
    if (hasString) return { type: 'string' };
  }
  return { type: 'string' };
}

function generateSchema() {
  const indexFiles = getComponentIndexFiles(CATALOG_DIR);
  console.log(`Found ${indexFiles.length} component files`);

  const program = ts.createProgram(indexFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.Preserve,
  });
  const checker = program.getTypeChecker();

  for (const file of indexFiles) {
    const sourceFile = program.getSourceFile(file);
    if (!sourceFile) continue;

    const componentDir = path.dirname(file);
    const componentName = path.basename(componentDir);

    const accessedProps = new Map<string, any>();

    function processFunctionLike(
      funcNode:
        | ts.FunctionDeclaration
        | ts.ArrowFunction
        | ts.FunctionExpression,
      propsParam: ts.ParameterDeclaration,
    ) {
      if (!propsParam) return;

      // Handle Component = ({ propA, propB }) => { ... }
      if (ts.isObjectBindingPattern(propsParam.name)) {
        propsParam.name.elements.forEach(el => {
          let prop = '';
          if (el.propertyName && ts.isIdentifier(el.propertyName)) {
            prop = el.propertyName.text;
          } else if (ts.isIdentifier(el.name)) {
            prop = el.name.text;
          }
          if (prop && !GENERIC_PROPS.has(prop)) {
            accessedProps.set(prop, { type: 'string' });
          }
        });
      } // Handle Component = (props) => { ... }
      else if (ts.isIdentifier(propsParam.name)) {
        const propsName = propsParam.name.text;

        function visitBody(bodyNode: ts.Node) {
          if (
            ts.isElementAccessExpression(bodyNode)
            && ts.isIdentifier(bodyNode.expression)
            && bodyNode.expression.text === propsName
          ) {
            if (ts.isStringLiteral(bodyNode.argumentExpression)) {
              const prop = bodyNode.argumentExpression.text;
              if (!GENERIC_PROPS.has(prop)) {
                accessedProps.set(
                  prop,
                  parseInferredTypes(bodyNode.parent, checker),
                );
              }
            }
          } else if (
            ts.isPropertyAccessExpression(bodyNode)
            && ts.isIdentifier(bodyNode.expression)
            && bodyNode.expression.text === propsName
          ) {
            const prop = bodyNode.name.text;
            if (!GENERIC_PROPS.has(prop)) {
              accessedProps.set(
                prop,
                parseInferredTypes(bodyNode.parent, checker),
              );
            }
          } else if (
            ts.isVariableDeclaration(bodyNode) && bodyNode.initializer
            && ts.isIdentifier(bodyNode.initializer)
            && bodyNode.initializer.text === propsName
          ) {
            if (ts.isObjectBindingPattern(bodyNode.name)) {
              bodyNode.name.elements.forEach(el => {
                let prop = '';
                if (el.propertyName && ts.isIdentifier(el.propertyName)) {
                  prop = el.propertyName.text;
                } else if (ts.isIdentifier(el.name)) {
                  prop = el.name.text;
                }
                if (prop && !GENERIC_PROPS.has(prop)) {
                  accessedProps.set(prop, { type: 'string' });
                }
              });
            }
          }
          ts.forEachChild(bodyNode, visitBody);
        }
        if (funcNode.body) {
          visitBody(funcNode.body);
        }
      }
    }

    function visitNode(node: ts.Node) {
      if (
        ts.isFunctionDeclaration(node) && node.name?.getText() === componentName
      ) {
        processFunctionLike(node, node.parameters[0]);
      } else if (ts.isVariableStatement(node)) {
        node.declarationList.declarations.forEach(decl => {
          if (ts.isIdentifier(decl.name) && decl.name.text === componentName) {
            if (
              decl.initializer
              && (ts.isArrowFunction(decl.initializer)
                || ts.isFunctionExpression(decl.initializer))
            ) {
              processFunctionLike(
                decl.initializer,
                decl.initializer.parameters[0],
              );
            }
          }
        });
      }
      ts.forEachChild(node, visitNode);
    }

    visitNode(sourceFile);

    // Merge step with current catalog.json base mapping to satisfy full strict bounds
    // Without altering AST components, we retain descriptions, complex A2UI mapping
    const catalogJsonPath = path.join(componentDir, 'catalog.json');
    let baseSchema: any = { type: 'object', properties: {} };
    if (fs.existsSync(catalogJsonPath)) {
      const content = fs.readFileSync(catalogJsonPath, 'utf8');
      const fullJson = JSON.parse(content);
      if (fullJson[componentName]) {
        baseSchema = fullJson[componentName];
      }
    }

    if (!baseSchema.properties) baseSchema.properties = {};

    // Hydrate AST mapped properties into the formal catalog
    for (const [propName, propSchema] of accessedProps.entries()) {
      if (!baseSchema.properties[propName]) {
        baseSchema.properties[propName] = propSchema;
      }
    }

    const outDir = path.join(DIST_CATALOG_DIR, componentName);
    fs.mkdirSync(outDir, { recursive: true });

    const finalSchema = { [componentName]: baseSchema };
    const finalSchemaStr = JSON.stringify(finalSchema, null, 2);

    fs.writeFileSync(
      path.join(outDir, 'catalog.json'),
      finalSchemaStr + '\n',
    );

    console.log(`Generated schemas for ${componentName}`);
  }
}

generateSchema();
