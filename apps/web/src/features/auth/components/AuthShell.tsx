import type { ReactElement, ReactNode } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { PhoneShot } from '../../../components/ProductShot';
import { SignTitle } from '../../../components/SignTitle';

/** Marco de acceso y recuperación: campo cobalto de marca + formulario sobre blanco. */
export default function AuthShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="ws-auth-shell">
      <div className="flex-1 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="sg-on-color relative hidden flex-col overflow-hidden bg-(--sg-cobalt) px-12 pt-12 text-white lg:flex xl:px-16">
          <Brand tone="white" />
          <div className="mt-20">
            <SignTitle
              as="p"
              lines={['Tus planes.', 'Su progreso.']}
              className="text-[clamp(2.4rem,3.5vw,3.5rem)]"
              colors={{
                fill: '#ffffff',
                gap: 'var(--sg-cobalt)',
                ringA: 'var(--sg-pink)',
                ringB: 'var(--sg-orange)',
              }}
            />
            <p className="mt-7 max-w-[19rem] text-lg leading-relaxed text-white/90">
              Evaluaciones, rutinas, alimentación y el check-in de cada cliente
              en un mismo expediente.
            </p>
            <p className="mt-4 max-w-[19rem] text-sm text-white/80">
              Captura real de la app con datos de demostración.
            </p>
          </div>
          <div className="absolute bottom-0 right-12 w-[40%] max-w-[250px] translate-y-[38%] xl:right-16">
            <PhoneShot
              screen="movil-inicio"
              alt="Inicio de la app del cliente con su entrenamiento de hoy, su check-in y su alimentación del día."
              rings={{
                gap: 'var(--sg-cobalt)',
                ring1: '#ffffff',
                ring2: 'var(--sg-pink)',
                ring3: 'var(--sg-orange)',
              }}
            />
          </div>
        </aside>

        <div className="flex min-h-svh min-w-0 flex-col">
          <header className="flex items-center justify-between gap-4 bg-(--sg-cobalt) px-4 py-4 max-lg:[--sg-focus:#ffffff] sm:px-8 lg:bg-transparent lg:py-6">
            <span className="lg:invisible">
              <Brand tone="white" />
            </span>
            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 hover:underline lg:text-(--sg-ink)"
            >
              Volver al inicio <Icon name="arrow-up-right" size={14} />
            </Link>
          </header>
          <main className="mx-auto w-full max-w-md px-4 py-10 sm:py-14 lg:my-auto">
            <div className="ws-auth-card pt-8">{children}</div>
          </main>
          <footer className="px-4 pb-6 text-center text-xs text-(--sg-ink-2)">
            <Link
              to="/privacidad"
              className="underline-offset-4 hover:underline"
            >
              Privacidad y condiciones de uso
            </Link>
          </footer>
        </div>
      </div>
    </div>
  );
}
