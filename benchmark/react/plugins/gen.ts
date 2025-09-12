// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { humanId } from 'human-id';

const DYNAMIC_ATTR_RATE = 0.3;
const DYNAMIC_ATTR_COUNT_MAX = 10;
const DYNAMIC_TEXT_RATE = 0.7;
const COMPONENT_RATE = 0.2;
const COMPONENT_PROPS_RATE = 0.5;

const genStr = (r: Random) => {
  const oldRandom = Math.random;
  try {
    Math.random = () => r.random();
    return humanId({ adjectiveCount: 0, addAdverb: false });
  } finally {
    Math.random = oldRandom;
  }
};

const genValue = (r: Random, refVar: RefVar): string => {
  if (refVar.type === 'string') {
    return `"${genStr(r)}"`;
  } else if (refVar.type === 'boolean') {
    return pickRandomly(r, ['true', 'false']);
  } else if (refVar.type === 'number') {
    return ~~(2 ** 31 * r.random()) + '';
  }

  throw new Error('unreachable');
};

const genJsIdentifier = (r: Random, prefix = 'value') => {
  const oldRandom = Math.random;
  try {
    Math.random = () => r.random();
    return `${prefix}${humanId({ adjectiveCount: 1 })}`;
  } finally {
    Math.random = oldRandom;
  }
};

interface RefVar {
  id: string;
  type: 'number' | 'string' | 'boolean';
}

interface Decl {
  id: string;
  code: string;
}

interface Gen {
  code: string;
  decls: Array<Decl>;
  refVars: Array<RefVar>;
  usedComplexity: number;
}

const ATTR_TYPES = [
  'Attr',
  'Dataset',
  'Event',
  'MT_Event',
  'Class',
  'Id',
] as const;

interface Random {
  random: () => number;
}

const pickRandomly = <T>(r: Random, items: readonly T[]): T => {
  return items[~~(r.random() * items.length)]!;
};

const divideRandomly = <T>(
  r: Random,
  items: readonly T[],
  p: number,
): [T[], T[]] => {
  const a1: T[] = [];
  const a2: T[] = [];
  for (const item of items) {
    if (r.random() < p) {
      a1.push(item);
    } else {
      a2.push(item);
    }
  }

  return [a1, a2];
};

const clamp = (num: number, min: number, max: number): number => {
  return Math.min(Math.max(num, min), max);
};

const genAttr = (r: Random): Gen & { key: string } => {
  const refVars: RefVar[] = [];
  const addToRefVars = (type: RefVar['type']): string => {
    const id = genJsIdentifier(r);
    refVars.push({ id, type });
    return id;
  };

  const isDynamic = r.random() < DYNAMIC_ATTR_RATE;
  const attrType = pickRandomly(r, [...ATTR_TYPES, 'Attr', 'Attr', 'Attr']);

  switch (attrType) {
    case 'Attr': {
      const key = `attr-${genStr(r)}`;
      if (isDynamic) {
        return {
          code: `${key}={${addToRefVars('string')}}`,
          refVars,
          decls: [],
          usedComplexity: 2,
          key,
        };
      } else {
        return {
          code: `${key}="${genStr(r)}"`,
          refVars: [],
          decls: [],
          usedComplexity: 1,
          key,
        };
      }
    }
    case 'Dataset': {
      const key = `data-${genStr(r)}`;
      if (isDynamic) {
        return {
          code: `${key}={${addToRefVars('string')}}`,
          refVars,
          decls: [],
          usedComplexity: 2,
          key,
        };
      } else {
        return {
          code: `${key}="${genStr(r)}"`,
          refVars: [],
          decls: [],
          usedComplexity: 1,
          key,
        };
      }
    }
    case 'Id': {
      if (isDynamic) {
        return {
          code: `id={${addToRefVars('string')}}`,
          refVars,
          decls: [],
          usedComplexity: 2,
          key: 'id',
        };
      } else {
        return {
          code: `id="${genStr(r)}"`,
          refVars: [],
          decls: [],
          usedComplexity: 1,
          key: 'id',
        };
      }
    }
    case 'Event': {
      const eventType = pickRandomly(
        r,
        [
          'bind',
          'catch',
          'capture-bind',
          'capture-catch',
          'global-bind',
        ] as const,
      );
      const key = `${eventType}${genStr(r)}`;
      return {
        code: `${key}={() => {}}`,
        refVars: [],
        decls: [],
        usedComplexity: 2,
        key,
      };
    }
    case 'MT_Event': {
      const eventType = pickRandomly(
        r,
        [
          'bind',
          'catch',
          'capture-bind',
          'capture-catch',
          'global-bind',
        ] as const,
      );
      const key = `main-thread:${eventType}${genStr(r)}`;
      return {
        code: `${key}={() => { 'main-thread' }}`,
        refVars: [],
        decls: [],
        usedComplexity: 2,
        key,
      };
    }
    case 'Class':
      if (isDynamic) {
        return {
          code: `className={${addToRefVars('string')}}`,
          refVars,
          decls: [],
          usedComplexity: 2,
          key: 'className',
        };
      } else {
        return {
          code: `className="${genStr(r)}"`,
          refVars: [],
          decls: [],
          usedComplexity: 1,
          key: 'className',
        };
      }
    default:
      throw new Error('unreachable');
  }
};

const genFC = (r: Random, complexity: number, inner?: string): Gen => {
  let usedComplexity = 0;

  complexity -= 1;
  usedComplexity += 1;

  const fcName = genJsIdentifier(r, '');

  if (complexity <= 0) {
    return {
      code: `<${fcName} />`,
      decls: [{
        code: `const ${fcName} = () => null`,
        id: fcName,
      }],
      refVars: [],
      usedComplexity,
    };
  }

  if (inner) {
    const jsx1 = genJSX(r, ~~(complexity / 2), 1);
    const jsx2 = genJSX(r, ~~(complexity / 2), 1);
    const [refVars, refStates] = divideRandomly(r, [
      ...jsx1.refVars,
      ...jsx2.refVars,
    ], COMPONENT_PROPS_RATE);
    usedComplexity += jsx1.usedComplexity + jsx2.usedComplexity;
    return {
      code: `<${fcName} ${
        refVars.map((v) => `${v.id}={${v.id}}`).join(' ')
      }>${inner}</${fcName}>`,
      refVars,
      decls: [...jsx1.decls, ...jsx2.decls, {
        code: `const ${fcName} = ({ children, ${
          refVars.map(v => v.id).join(', ')
        } }) => { ${
          refStates.map(v => `const [${v.id},] = useState(${genValue(r, v)});`)
            .join(
              '',
            )
        } return (<view>${
          pickRandomly(r, [
            () => `{children}${jsx1.code}${jsx2.code}`,
            () => `${jsx1.code}{children}${jsx2.code}`,
            () => `${jsx1.code}${jsx2.code}{children}`,
          ])()
        }</view>) }`,
        id: fcName,
      }],
      usedComplexity,
    };
  } else {
    const jsx = genJSX(r, complexity, 0);
    const [refVars, refStates] = divideRandomly(
      r,
      jsx.refVars,
      COMPONENT_PROPS_RATE,
    );
    usedComplexity += jsx.usedComplexity;
    return {
      code: `<${fcName} ${
        refVars.map((v) => `${v.id}={${v.id}}`).join(' ')
      } />`,
      refVars,
      decls: [...jsx.decls, {
        code: `const ${fcName} = ({ ${
          refVars.map(v => v.id).join(', ')
        } }) => { ${
          refStates.map(v => `const [${v.id},] = useState(${genValue(r, v)});`)
            .join(
              '',
            )
        } return (${jsx.code}) }`,
        id: fcName,
      }],
      usedComplexity,
    };
  }
};

const genJSX = (r: Random, complexity: number, depth: number): Gen => {
  if (complexity <= 0) {
    return {
      code: '',
      decls: [],
      refVars: [],
      usedComplexity: 0,
    };
  }

  let usedComplexity = 0;
  let code = '';

  // const tag = pickRandomly(r, ['view', 'text']);
  const tag = 'view';
  complexity -= 1;
  usedComplexity += 1;

  code += `<${tag}`;

  const refVars: RefVar[] = [];
  const decls: Decl[] = [];

  if (complexity > 0) {
    const attrCount = clamp(
      ~~(r.random() * DYNAMIC_ATTR_COUNT_MAX),
      0,
      ~~(complexity / 2),
    );
    const attrKeys = new Set<string>();
    for (let i = 0; i < attrCount;) {
      const attr = genAttr(r);
      if (attrKeys.has(attr.key)) {
        continue;
      }

      i++;
      code += ` ${attr.code}`;
      refVars.push(...attr.refVars);
      attrKeys.add(attr.key);
      complexity -= attr.usedComplexity;
      usedComplexity += attr.usedComplexity;
      if (complexity <= 0) {
        complexity = 0;
        break;
      }
    }
  }

  code += '>';

  if (complexity > 0) {
    while (true) {
      // The more deeper the nesting, the more likely to generate a
      // ending (a Function Component without children or a text node)
      if (r.random() > 1 / 2 ** depth) {
        // generate a ending
        if (r.random() < COMPONENT_RATE) {
          const fc = genFC(r, complexity, undefined);
          code += fc.code;
          refVars.push(...fc.refVars);
          decls.push(...fc.decls);
          complexity -= fc.usedComplexity;
          usedComplexity += fc.usedComplexity;
        } else {
          if (r.random() < DYNAMIC_TEXT_RATE && complexity > 2) {
            const id = genJsIdentifier(r);
            code += `<text>{${id}}</text>`;
            refVars.push({ id, type: 'string' });
            complexity -= 2;
            usedComplexity += 2;
          } else if (complexity > 1) {
            code += `<text>${genStr(r)}</text>`;
            complexity -= 1;
            usedComplexity += 1;
          }
        }
      } else {
        // generate a nesting
        const jsx = genJSX(r, ~~(complexity * r.random()), depth + 1);
        complexity -= jsx.usedComplexity;
        usedComplexity += jsx.usedComplexity;
        if (r.random() < COMPONENT_RATE) {
          const fc = genFC(r, complexity, jsx.code);
          code += fc.code;
          refVars.push(...fc.refVars, ...jsx.refVars);
          decls.push(...fc.decls, ...jsx.decls);
          complexity -= fc.usedComplexity;
          usedComplexity += fc.usedComplexity;
        } else {
          code += jsx.code;
          refVars.push(...jsx.refVars);
          decls.push(...jsx.decls);
        }
      }

      if (complexity <= 0) {
        break;
      }
    }
  }

  code += `</${tag}>`;

  return {
    code,
    refVars,
    decls,
    usedComplexity,
  };
};

const genRandom = function(randomSeed: number) {
  let seed = randomSeed;
  return function() {
    // Robert Jenkins' 32 bit integer hash function.
    seed = ((seed + 0x7ed55d16) + (seed << 12)) & 0xffffffff;
    seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffffffff;
    seed = ((seed + 0x165667b1) + (seed << 5)) & 0xffffffff;
    seed = ((seed + 0xd3a2646c) ^ (seed << 9)) & 0xffffffff;
    seed = ((seed + 0xfd7046c5) + (seed << 3)) & 0xffffffff;
    seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffffffff;
    return (seed & 0xfffffff) / 0x10000000;
  };
};

const gen = (randomSeed: number, complexity: number): string => {
  const r = {
    random: genRandom(randomSeed),
  };

  const g = genJSX(r, complexity, 0);

  return `(({useState}, genRandom, genValue) => {
${g.decls.map(d => d.code).join('\n')}
return ({seed}) => {
  const r = { random: genRandom(seed) }
  ${
    g.refVars.map(v => `const ${v.id} = genValue(r, { type: "${v.type}" });`)
      .join(
        '\n',
      )
  }
  return (${g.code})
}; 
})`;
};

export { gen, genValue, genRandom };
