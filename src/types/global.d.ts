import type React from 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'altcha-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        challengeurl?: string;
        auto?: string;
        hidelogo?: boolean;
        hidefooter?: boolean;
      }, HTMLElement>;
    }
  }
}
