import type { ReactElement } from 'react';
import { Link } from './Link';
import { LogoMark } from './LogoMark';

/** Marca de las superficies públicas (landing, acceso, registro, privacidad). */
export function Brand({
  tone = 'ink',
}: {
  tone?: 'ink' | 'white';
}): ReactElement {
  return (
    <Link
      className={`sg-display inline-flex select-none items-center gap-2.5 whitespace-nowrap text-[17px] font-bold no-underline ${tone === 'white' ? 'text-white' : 'text-(--sg-ink)'}`}
      to="/"
      aria-label="CouchOne Fit, inicio"
    >
      <LogoMark size={38} variant={tone} />
      <span>CouchOne Fit</span>
    </Link>
  );
}
