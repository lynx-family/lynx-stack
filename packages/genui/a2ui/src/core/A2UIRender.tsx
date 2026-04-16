import { useState, useEffect, memo, type ReactNode } from '@lynx-js/react';
import { componentRegistry } from "./ComponentRegistry";
import { type Resource, type Surface, type ComponentInstance } from "./types";
import { useResolvedProps } from "./useDataBinding";
import { useAction } from "./useAction";

function Loading(props: { id: string }) {
  const content = `loading ${props.id}...`;
  return (
    <view
      style={{
        width: '100%',
        minHeight: '20px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '6px',
      }}
    >
      <text style={{ color: '#666' }}>{content}</text>
    </view>
  );
}

function buildNodeRecursive(
  component: ComponentInstance,
  surface: Surface,
  resolvedProps?: any,
  setValue?: (key: string, value: any) => void,
  sendAction?: (action: any) => any
): ReactNode {
  const tag = component.component;

  if (componentRegistry.has(tag)) {
    const Component = componentRegistry.get(tag)!;
    return (
      <Component
        key={component.id}
        id={component.id}
        surface={surface}
        setValue={setValue}
        sendAction={sendAction}
        dataContextPath={component.dataContextPath}
        {...resolvedProps}
      />
    );
  }

  console.warn(`Component ${tag} not registered in v0.9 registry.`);
  return null;
}

function A2UIRenderImpl(props: { resource: Resource; renderFallback?: () => any }): any {
  const { resource } = props;
  const [data, setData] = useState<any>(() => {
    if (resource.completed) {
      try {
        return resource.read();
      } catch {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(!resource.completed);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let active = true;

    if (resource.completed) {
      try {
        const res = resource.read();
        if (active) {
          setData(res);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err);
          setLoading(false);
        }
      }
    } else {
      resource.promise
        .then((res) => {
          if (active) {
            setData(res);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err);
            setLoading(false);
          }
        });
    }

    const unsubscribe = resource.onUpdate((newData) => {
      if (active) {
        setData(newData);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [resource]);

  if (loading) {
    return props.renderFallback?.() || <Loading id={resource.id} />;
  }

  if (error) {
    return <text>Error: {String(error)}</text>;
  }

  if (!data) return null;

  const { type, surfaceId, surface, component } = data;
  if (type === 'beginRendering') {
    const id = surface.rootComponentId!;
    const childResource = surface.resources.get(id!);
    if (!childResource) return null;
    return (
      <view id={`surface-${surfaceId}`} className="luna-light">
        <A2UIRender resource={childResource} />
      </view>
    );
  }

  if (type === 'surfaceUpdate' && component) {
    return <NodeRenderer component={component} surface={surface} />;
  }

  if (type === 'deleteSurface') {
    return null;
  }

  return null;
}

export const A2UIRender = memo(A2UIRenderImpl);

export function NodeRenderer(props: {
  component: ComponentInstance;
  surface: Surface;
}) : any {
  const { component: initialComponent, surface } = props;
  const [component, setComponent] = useState(initialComponent);

  useEffect(() => {
    setComponent(initialComponent);
  }, [initialComponent]);

  useEffect(() => {
    const resource = surface.resources.get(component.id!);
    if (!resource) return;

    return resource.onUpdate((data) => {
      if (data.type === 'surfaceUpdate' && data.component) {
        setComponent({ ...(data.component as ComponentInstance) });
      }
    });
  }, [component.id, surface]);

  const [resolvedProps, setValue] = useResolvedProps(
    component,
    surface,
    component.dataContextPath
  );

  const { sendAction } = useAction({
    id: component.id!,
    surfaceId: surface.surfaceId,
    dataContext: component.dataContextPath
  });

  return <>{buildNodeRecursive(component, surface, resolvedProps, setValue, sendAction)}</>;
}
