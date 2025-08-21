// in order to make our test case work for
// both vitest and rstest, we need to alias
// `vitest` to `@rstest/core`

global['@rstest/core'].vi = global['@rstest/core'].rs;
module.exports = global['@rstest/core'];
