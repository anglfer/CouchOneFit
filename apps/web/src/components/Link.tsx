import type { AnchorHTMLAttributes, MouseEvent, ReactElement } from 'react';
import { navigate } from '../utils/navigation';

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

/**
 * Enlace SPA para navegación fluida sin recargar la página ni perder el layout.
 */
export function Link({
  to,
  replace,
  onClick,
  target,
  children,
  ...rest
}: LinkProps): ReactElement {
  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      (target && target !== '_self')
    ) {
      return;
    }

    if (to.startsWith('/') || to.startsWith('#')) {
      event.preventDefault();
      navigate(to, { replace });
    }
  }

  return (
    <a href={to} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
