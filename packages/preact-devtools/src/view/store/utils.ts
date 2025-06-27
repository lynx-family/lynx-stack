// See: https://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
export function escapeStringRegexp(string: string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
