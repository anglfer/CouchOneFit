import type { ReactElement, ReactNode } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';

const highlights = [
  'Expedientes de tus clientes en un solo lugar.',
  'Invitaciones privadas para vincular cada cuenta.',
  'Instálala como app en tu escritorio o móvil.',
];

/** Marco de las pantallas de acceso: panel de marca + formulario. */
export default function AuthShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="grid min-h-svh bg-[#f8f9fd] text-slate-900 lg:grid-cols-[5fr_6fr]">
      <aside
        className="hidden flex-col justify-between p-12 text-white lg:flex"
        style={{ background: 'var(--brand-gradient)' }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-lg font-bold no-underline"
          aria-label="CouchOne Fit, inicio"
        >
          <img
            src="/pwa-192x192.png"
            alt=""
            width="40"
            height="40"
            className="rounded-xl"
          />
          CouchOne Fit
        </Link>
        <div className="space-y-6">
          <p className="text-4xl font-bold leading-tight tracking-tight">
            Tus planes.
            <br />
            Su progreso.
          </p>
          <ul className="m-0 list-none space-y-3 p-0 text-base text-white/90">
            {highlights.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20">
                  <Icon name="check" size={14} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/70">
          Sistema interno seguro · CouchOne Fit
        </p>
      </aside>

      <div className="flex min-w-0 flex-col px-4 py-6 sm:px-10">
        <header className="flex items-center justify-between py-2">
          <div className="lg:invisible">
            <Brand />
          </div>
          <Link
            to="/"
            className="text-sm font-semibold text-slate-600 hover:text-indigo-700"
          >
            Volver al inicio <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <main className="m-auto w-full max-w-md py-8">{children}</main>
        <footer className="py-2 text-center text-xs text-slate-500 lg:hidden">
          CouchOne Fit · Sistema interno seguro
        </footer>
      </div>
    </div>
  );
}
