import type { ReactElement } from 'react';
import { Link } from './Link';
import { LogoMark } from './LogoMark';

export function Brand(): ReactElement {
  return (
    <Link
      className="inline-flex select-none items-center whitespace-nowrap gap-2.5 text-lg font-bold tracking-tight text-slate-900 no-underline focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600"
      to="/"
      aria-label="CouchOne Fit, inicio"
    >
      <LogoMark size={36} />
      <span>
        CouchOne<span className="font-semibold text-indigo-600"> Fit</span>
      </span>
    </Link>
  );
}
