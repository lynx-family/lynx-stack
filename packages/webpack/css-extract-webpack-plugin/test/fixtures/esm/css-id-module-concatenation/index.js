import path from 'node:path';
import './a.css?cssId=42';
import './b.css?cssId=42';
import './c.css?cssId=52';

it('should extract correct CSS', async () => {
  const fs = require('node:fs');
  const content = await fs.promises.readFile(
    __filename.replace('.js', '.css'),
    'utf-8',
  );

  expect(content).toContain(`\
@cssId "42" "esm/css-id-module-concatenation/a.css" {
.a {
  background: red;
}

}
`.replaceAll('/', path.sep));
  expect(content).toContain(`\
@cssId "42" "esm/css-id-module-concatenation/b.css" {
.b {
  background: green;
}

}
`.replaceAll('/', path.sep));
  expect(content).toContain(`\
@cssId "52" "esm/css-id-module-concatenation/c.css" {
.c {
  background: blue;
}

}
`.replaceAll('/', path.sep));

  // All modules should be concatenated into the root module
  expect(
    Array.isArray(__webpack_require__)
      ? __webpack_require__
      : Object.keys(__webpack_modules__),
  ).toHaveLength(1);
});
