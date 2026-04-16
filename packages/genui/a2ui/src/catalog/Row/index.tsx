import * as v0_9 from '@a2ui/web_core/v0_9';
import type { ComponentProps } from "../../core/ComponentRegistry";
import { NodeRenderer } from "../../core/A2UIRender";

import './style.css';

export interface RowProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function Row(props: any): any {
  const { children, surface, dataContextPath, justify = 'start', align = 'stretch' } = props;
  const explicitChildren = Array.isArray(children) ? children : [];

  return (
    <view className={`row alignment-${align} distribution-${justify}`}>
      {explicitChildren.map((childId: string) => {
        const child = surface.components.get(childId);
        if (!child) return null;
        const childWithContext = dataContextPath
          ? { ...child, dataContextPath: dataContextPath }
          : child;
        return (
          <NodeRenderer
            key={childId}
            component={childWithContext as any}
            surface={surface}
          />
        );
      })}
    </view>
  );
}
