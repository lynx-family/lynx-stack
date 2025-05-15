function updateStyle(cssId = 0) {
  const cssHotUpdateList = __webpack_require__.cssHotUpdateList;
  const lynxLazyChunkIds = __webpack_require__.lynxLazyChunkIds;

  if (!cssHotUpdateList) {
    throw new Error('cssHotUpdateList is not found');
  }

  if (!lynxLazyChunkIds) {
    throw new Error('lynxLazyChunkIds is not found');
  }

  for (const [chunkName, cssHotUpdatePath] of cssHotUpdateList) {
    if (!lynxLazyChunkIds.includes(chunkName)) continue;

    lynx.requireModuleAsync(
      __webpack_require__.p + cssHotUpdatePath,
      (err, ret) => {
        if (err) {
          throw new Error(
            `Failed to load CSS update file: ${cssHotUpdatePath}`,
          );
        }

        if (ret.content) {
          lynx.getCoreContext().dispatchEvent({
            type: 'lynx.hmr.css',
            data: {
              cssId,
              content: ret.content,
              deps: ret.deps,
              entry: lynx.__chunk_entries__[chunkName],
            },
          });
        }
      },
    );
  }
}

/**
 * @param {string | number} moduleId
 * @param {unknown} options
 * @param {number=} cssId
 * @returns {() => void}
 */
module.exports = function lazyChunkInitialLoading(moduleId, options, cssId) {
  // TODO: should not pass cssId === ''
  if (!cssId) {
    cssId = 0;
  }

  function lazyChunkInitialLoading() {
    updateStyle(cssId);
  }

  return lazyChunkInitialLoading;
};
