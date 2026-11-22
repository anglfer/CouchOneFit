import type { ReactElement, ReactNode } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { PanelShot } from '../../../components/ProductShot';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Marco de acceso y recuperación: formulario a la izquierda y, en escritorio,
 * el panel real (datos de demostración) sobre el campo de marca.
 */
export default function AuthShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="mk-page mk-auth grid min-h-svh bg-white text-brand-ink lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex min-w-0 flex-col px-4 py-5 sm:px-10 lg:px-14 lg:py-7">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-brand-muted transition-colors hover:text-brand-primary"
          >
            <Icon name="arrow-right" size={16} className="rotate-180" />
            Volver al inicio
          </Link>
        </header>

        <main className="mx-auto my-auto w-full max-w-[400px] py-12">
          {children}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm text-[#5b6388]">
          <span>© {CURRENT_YEAR} CouchOne Fit</span>
          <Link
            to="/privacidad"
            className="inline-flex min-h-11 items-center hover:text-brand-primary"
          >
            Privacidad y condiciones de uso
          </Link>
        </footer>
      </div>

      <aside
        className="mk-on-color relative hidden overflow-hidden lg:block"
        style={{ background: 'var(--brand-gradient)' }}
        aria-label="Vista del panel profesional"
      >
        <div className="relative z-10 max-w-[470px] px-14 pt-16 xl:pt-20">
          <p className="font-display text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.03em] text-balance text-white">
            Tu cartera, de un vistazo.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-indigo-50">
            Quién entrenó, quién registró su check-in y quién necesita tu
            atención hoy, en cuanto entras.
          </p>
          <p className="mt-5 text-sm text-indigo-100">
            Captura real del panel con datos de demostración.
          </p>
        </div>
        <PanelShot
          screen="panel-inicio"
          eager
          alt="Inicio del panel profesional: clientes activos, quién entrenó esta semana, check-ins de hoy y clientes que necesitan atención."
          className="absolute left-14 top-[340px] w-[min(1040px,140%)] xl:top-[360px]"
        />
      </aside>
    </div>
  );
}
