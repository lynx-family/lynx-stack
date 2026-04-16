import * as v0_9 from '@a2ui/web_core/v0_9';
import type { ComponentProps } from "../../core/ComponentRegistry";
import { NodeRenderer } from "../../core/A2UIRender";

import './style.css';

export interface CardProps extends ComponentProps {
  component: v0_9.AnyComponent & { dataContextPath?: string };
}

export function Card(props: any): any {
  const { child: childId, surface, dataContextPath } = props;
  const childComponent = surface.components.get(childId);
  const childWithContext =
    childComponent && dataContextPath
      ? { ...childComponent, dataContextPath: dataContextPath }
      : childComponent;
      console.log('=====', dataContextPath, childWithContext)

  return (
    <view className="card card-elevated">
      {childWithContext && (
        <NodeRenderer
          component={childWithContext as any}
          surface={surface}
        />
      )}
    </view>
  );
}
