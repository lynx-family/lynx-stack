/// <reference types="vitest/globals" />

__webpack_require__.j = 'a';
__webpack_public_path__ = 'a';

export {};

it('should keep webpack runtime variables', () => {
  expect(__webpack_require__.j).toBe('a');
  expect(__webpack_require__.p).toBe('a');
});
