export type PropDataType =
  | 'boolean'
  | 'string'
  | 'number'
  | 'array'
  | 'map'
  | 'set'
  | 'object'
  | 'null'
  | 'undefined'
  | 'function'
  | 'bigint'
  | 'vnode'
  | 'signal'
  | 'blob'
  | 'symbol'
  | 'html';

export type PropData = {
  id: string;
  name: string;
  type: PropDataType;
  value: any;
  editable: boolean;
  depth: number;
  meta: any;
  children: string[];
  index?: number;
};

export function parseProps(
  data: any,
  path: string,
  limit: number,
  depth = 0,
  name = path,
  out = new Map<string, PropData>(),
  forceReadonly = false,
): Map<string, PropData> {
  if (depth >= limit) {
    out.set(path, {
      depth,
      name,
      id: path,
      type: 'string',
      editable: false,
      value: '…',
      children: [],
      meta: null,
    });
    return out;
  }

  if (Array.isArray(data)) {
    const children: string[] = [];
    out.set(path, {
      depth,
      name,
      id: path,
      type: 'array',
      editable: false,
      value: data,
      children,
      meta: null,
    });
    data.forEach((item, i) => {
      const childPath = `${path}.${i}`;
      children.push(childPath);
      parseProps(item, childPath, limit, depth + 1, '' + i, out, forceReadonly);
    });
  } else if (typeof data === 'object') {
    if (data === null) {
      out.set(path, {
        depth,
        name,
        id: path,
        type: 'null',
        editable: false,
        value: data,
        children: [],
        meta: null,
      });
    } else {
      const keys = Object.keys(data);
      const maybeCustom = keys.length === 2;
      const maybeCollection = keys.length === 3;
      // Functions are encoded as objects
      if (
        maybeCustom
        && typeof data.name === 'string'
        && data.type === 'function'
      ) {
        out.set(path, {
          depth,
          name,
          id: path,
          type: 'function',
          editable: false,
          value: data,
          children: [],
          meta: null,
        });
      } else if (
        // Same for bigints
        maybeCustom
        && typeof data.value === 'string'
        && data.type === 'bigint'
      ) {
        out.set(path, {
          depth,
          name,
          id: path,
          type: 'bigint',
          editable: !forceReadonly,
          value: data,
          children: [],
          meta: null,
        });
      } else if (
        // Same for vnodes
        maybeCustom
        && typeof data.name === 'string'
        && data.type === 'vnode'
      ) {
        out.set(path, {
          depth,
          name,
          id: path,
          type: 'vnode',
          editable: false,
          value: data,
          children: [],
          meta: null,
        });
      } else if (
        // Same for Set + Map
        maybeCollection
        && typeof data.name === 'string'
        && data.type === 'set'
      ) {
        const children: any[] = [];
        const node: PropData = {
          depth,
          name,
          id: path,
          type: 'set',
          editable: false,
          value: data,
          children,
          meta: null,
        };

        (data.entries as any[]).forEach((item, i) => {
          const childPath = `${path}.${i}`;
          children.push(childPath);
          parseProps(
            item,
            childPath,
            limit,
            depth + 1,
            '' + i,
            out,
            forceReadonly,
          );
        });
        out.set(path, node);
      } else if (
        // Same for Map
        maybeCollection
        && typeof data.name === 'string'
        && data.type === 'map'
      ) {
        const children: any[] = [];
        const node: PropData = {
          depth,
          name,
          id: path,
          type: 'map',
          editable: false,
          value: data,
          children,
          meta: null,
        };

        (data.entries as any[]).forEach((item, i) => {
          const childPath = `${path}.${i}`;
          children.push(childPath);
          parseProps(
            item,
            childPath,
            limit,
            depth + 1,
            '' + i,
            out,
            forceReadonly,
          );
        });
        out.set(path, node);
      } else if (
        // Same for Blobs
        maybeCustom
        && typeof data.name === 'string'
        && data.type === 'blob'
      ) {
        out.set(path, {
          depth,
          name,
          id: path,
          type: 'blob',
          editable: false,
          value: data,
          children: [],
          meta: null,
        });
      } else if (
        // Same for Symbols
        maybeCustom
        && typeof data.name === 'string'
        && data.type === 'symbol'
      ) {
        out.set(path, {
          depth,
          name,
          id: path,
          type: 'symbol',
          editable: false,
          value: data,
          children: [],
          meta: null,
        });
      } else if (
        // Same for HTML elements
        maybeCustom
        && typeof data.name === 'string'
        && data.type === 'html'
      ) {
        out.set(path, {
          depth,
          name,
          id: path,
          type: 'html',
          editable: false,
          value: data,
          children: [],
          meta: null,
        });
      } else if (
        // Same for Signals
        maybeCollection
        && typeof data.name === 'string'
        && data.type === 'signal'
      ) {
        const children: string[] = [];
        const isEditable = data.name === 'Signal';
        const node: PropData = {
          depth,
          name,
          id: path,
          type: 'signal',
          editable: isEditable,
          value: data,
          children,
          meta: null,
        };
        const childPath = `${path}.value`;
        children.push(childPath);
        out.set(path, node);
        parseProps(
          data.value,
          childPath,
          limit,
          depth + 1,
          'value',
          out,
          !isEditable,
        );
      } else {
        const node: PropData = {
          depth,
          name,
          id: path,
          type: 'object',
          editable: false,
          value: data,
          children: [],
          meta: null,
        };
        out.set(path, node);

        Object.keys(data).forEach(key => {
          const nextPath = `${path}.${key}`;
          node.children.push(nextPath);
          parseProps(
            data[key],
            nextPath,
            limit,
            depth + 1,
            key,
            out,
            forceReadonly,
          );
        });

        out.set(path, node);
      }
    }
  } else {
    const type = typeof data;
    out.set(path, {
      depth,
      name,
      id: path,
      type: type as any,
      editable: type !== 'undefined' && data !== '[[Circular]]'
        && !forceReadonly,
      value: data,
      children: [],
      meta: null,
    });
  }

  return out;
}
