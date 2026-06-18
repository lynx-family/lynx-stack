// in order to make our test cases work for
// both vitest and rstest, we alias
// `vitest` to `@rstest/core`

global['@rstest/core'].vi = global['@rstest/core'].rs;
module.exports = global['@rstest/core'];
