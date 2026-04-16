import type { ResourceInfo, Resource } from '../core/types';

export function createResource(id: string): Resource {
  let _resolve: (info: ResourceInfo) => void;
  const promise = new Promise<ResourceInfo>((resolve) => {
    _resolve = resolve;
  });

  return {
    id,
    completed: false,
    read: () => { throw new Error("not implemented"); },
    complete: (result: ResourceInfo) => { _resolve(result); },
    onUpdate: () => { return () => {}; },
    promise,
  };
}
