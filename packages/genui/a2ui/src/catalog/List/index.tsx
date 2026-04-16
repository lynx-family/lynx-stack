import * as v0_9 from '@a2ui/web_core/v0_9';
import type { ComponentProps } from "../../core/ComponentRegistry";
import { NodeRenderer } from "../../core/A2UIRender";
import { useDataBinding } from '../../core/useDataBinding';

import './style.css';

export interface ListProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function List(props: any): any {
  const { children, surface, dataContextPath, direction = 'vertical' } = props;

  let content: any[] = [];

  if (Array.isArray(children)) {
    content = children.map((childId: string) => {
      const child = surface.components.get(childId);
      if (!child) return null;
      // Propagate dataContextPath
      const childWithContext = dataContextPath
        ? { ...child, dataContextPath: dataContextPath }
        : child;
      return {
        key: childId,
        component: childWithContext,
      };
    });
  } else if (children && typeof children === 'object') {
    const template = children as {
      path: string;
      componentId: string;
    };
    const dataPath = template.path;
    const componentId = template.componentId;

    const [listData, , fullPath] = useDataBinding<any[]>(
      { path: dataPath },
      surface,
      dataContextPath,
      []
    );

    const items = Array.isArray(listData) ? listData : [];

    content = items.map((item, index) => {
      const child = surface.components.get(componentId);
      if (!child) return null;

      const key =
        item && typeof item === 'object' && 'key' in item
          ? String(item.key)
          : `${index}`;

      const itemPath = `${fullPath}/${index}`;
      const childWithContext = { ...child, dataContextPath: itemPath };

      return {
        key: key,
        component: childWithContext,
      };
    });
  }

  return (
    <list
      className={`list list-${direction}`}
      scroll-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
      list-type="single"
      span-count={1}
    >
      {content.map((item) => {
        if (!item) return null;
        return (
          <list-item key={item.key} item-key={item.key}>
            <NodeRenderer
              component={item.component as any}
              surface={surface}
            />
          </list-item>
        );
      })}
    </list>
  );
}
