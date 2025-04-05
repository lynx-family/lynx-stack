// TypeScript definitions for Lynx JSX elements
import React from 'react';

// Lynx Event type for tap events
interface LynxTapEvent {
  type: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  preventDefault: () => void;
  stopPropagation: () => void;
}

// Add Lynx JSX types to global namespace
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'view': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          bindtap?: (e?: LynxTapEvent) => void;
          className?: string;
        },
        HTMLElement
      >;
      'text': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          bindtap?: (e?: LynxTapEvent) => void;
          className?: string;
        },
        HTMLElement
      >;
      'image': React.DetailedHTMLProps<
        React.ImgHTMLAttributes<HTMLImageElement> & {
          bindtap?: (e?: LynxTapEvent) => void;
          className?: string;
        },
        HTMLImageElement
      >;
    }
  }
}
