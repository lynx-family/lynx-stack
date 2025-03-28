declare function lazyChunkInitialLoading(
  moduleId: string | number,
  options: unknown,
  cssId?: number,
): () => void;

export = lazyChunkInitialLoading;
