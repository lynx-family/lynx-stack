import { h } from 'preact';
import { ComponentChildren } from 'preact';

export interface IconBtnProps {
  active?: boolean;
  title?: string;
  disabled?: boolean;
  color?: string;
  onClick?: () => void;
  styling?: 'secondary' | 'primary';
  children: ComponentChildren;
  testId?: string;
}

export function IconBtn(props: IconBtnProps) {
  return (
    <button
      type='button'
      class='icon-btn'
      data-kind={props.styling || null}
      data-active={props.active}
      title={props.title}
      disabled={props.disabled}
      data-testid={props.testId}
      onClick={e => {
        e.stopPropagation();
        if (props.onClick) props.onClick();
      }}
    >
      <span
        class='icon-btn-inner'
        tabIndex={-1}
        style={props.color ? 'color: ' + props.color : undefined}
      >
        {props.children}
        <span class='icon-btn-bg' />
      </span>
    </button>
  );
}
