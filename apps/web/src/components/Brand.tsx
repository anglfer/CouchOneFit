import type { ReactElement } from 'react';
import { Link } from './Link';
import { LogoMark } from './LogoMark';

export function Brand(): ReactElement {
  return (
    <Link
      className="inline-flex select-none items-center whitespace-nowrap gap-2.5 text-lg font-bold tracking-tight text-brand-ink no-underline focus-visible:rounded-lg"
      to="/"
      aria-label="CouchOne Fit, inicio"
    >
      <LogoMark size={36} />
      <span>
        CouchOne<span className="font-semibold text-brand-primary"> Fit</span>
      </span>
    </Link>
  );
}
