import { h, ComponentChildren } from 'preact';

const sizes: Record<string, string> = {
  xs: '.8rem',
  s: '1rem',
  m: '2rem',
  l: '4rem',
};

export type Size = keyof typeof sizes;

export interface Props {
  size?: Size;
}

export function createSvgIcon(size: Size, children: ComponentChildren) {
  return (
    <svg
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      style={`width: ${sizes[size]}; height: ${sizes[size]}`}
    >
      {children}
    </svg>
  );
}

export type Icon =
  | 'undo'
  | 'add-circle'
  | 'bug'
  | 'inspect'
  | 'remove'
  | 'refresh'
  | 'keyboard-down'
  | 'keyboard-up'
  | 'close'
  | 'search'
  | 'filter-list'
  | 'checkbox-checked'
  | 'checkbox-unchecked'
  | 'file-copy'
  | 'arrow-back'
  | 'arrow-forward'
  | 'record-icon'
  | 'not-interested'
  | 'sort-icon'
  | 'fire-icon'
  | 'code-icon'
  | 'suspend-icon';

export function Icon({ icon }: { icon: Icon }) {
  return (
    <svg class='svg-icon'>
      <use xlinkHref={`#preact-devtools-${icon}`} />
    </svg>
  );
}

export function Picker() {
  return (
    <svg width='16' height='16' xmlns='http://www.w3.org/2000/svg'>
      <g fill='none' fill-rule='evenodd'>
        <g stroke='currentColor'>
          <path
            stroke-width='.291'
            fill='currentColor'
            fill-rule='nonzero'
            stroke-linecap='round'
            stroke-linejoin='round'
            d='M6 6l3.014 9 2.508-3.533L15 8.791z'
          />
          <path stroke-width='2' d='M10.417 10.417l2.87 2.87L15 15' />
        </g>
        <path
          d='M12.188 0A2.812 2.812 0 0 1 15 2.813V5h-1V2.857A1.857 1.857 0 0 0 12.143 1H2.857A1.857 1.857 0 0 0 1 2.857v9.286C1 13.169 1.831 14 2.857 14H5v1H2.812A2.812 2.812 0 0 1 0 12.187V2.813A2.812 2.812 0 0 1 2.813 0h9.374z'
          fill='currentColor'
          fill-rule='nonzero'
        />
      </g>
    </svg>
  );
}
