import type { ReactElement } from 'react';
import { Link } from './Link';

export function Brand(): ReactElement {
  return (
    <Link
      className="inline-flex items-center gap-2.5 no-underline text-neutral-900 font-bold text-lg tracking-tight select-none focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:rounded-lg"
      to="/"
      aria-label="CouchOne Fit, inicio"
    >
      <span
        className="relative block w-8 h-8 overflow-hidden shrink-0 rounded-lg shadow-xs"
        aria-hidden="true"
      >
        <img
          src="/logo.png"
          alt=""
          className="absolute w-16 h-16 max-w-none -top-3 -left-3.5"
        />
      </span>
      <span>
        CouchOne<span className="text-indigo-600 font-semibold"> Fit</span>
      </span>
    </Link>
  );
}
