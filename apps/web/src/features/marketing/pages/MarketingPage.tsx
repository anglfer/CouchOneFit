import type { ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { MarketingNavigation } from '../components/MarketingNavigation';
import { ProductPreview } from '../components/ProductPreview';
import { ProductFeatures } from '../components/ProductFeatures';
import { ConnectedExperience } from '../components/ConnectedExperience';
import { HowItWorks } from '../components/HowItWorks';
import { Plans } from '../components/Plans';
import { FrequentlyAskedQuestions } from '../components/FrequentlyAskedQuestions';

const CURRENT_YEAR = new Date().getFullYear();

const assurances = [
  'Sin cobros al crear tu cuenta',
  'Web instalable como app',
  'App móvil para tus clientes',
];

const footerLinks = [
  { href: '#producto', label: 'El producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#planes', label: 'Planes' },
  { href: '#preguntas', label: 'Preguntas frecuentes' },
];

export default function MarketingPage(): ReactElement {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none"
        href="#contenido"
      >
        Saltar al contenido
      </a>
      <MarketingNavigation />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <section
          className="relative overflow-hidden border-b border-slate-200/80 bg-slate-50 pb-16 pt-16 sm:pt-20"
          aria-labelledby="hero-title"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-60"
            style={{
              background:
                'radial-gradient(60% 60% at 50% 0%, #e4e2ff 0%, transparent 70%)',
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="mx-auto mb-14 flex max-w-3xl flex-col items-center text-center">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 text-sm font-medium text-indigo-700">
                <span
                  className="size-2 rounded-full bg-emerald-500"
                  aria-hidden="true"
                />
                Para entrenadores y nutriólogos
              </p>

              <h1
                id="hero-title"
                className="text-5xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl"
              >
                <span className="block">Tus planes.</span>
                <span
                  className="block bg-clip-text pb-[0.12em] text-transparent"
                  style={{ backgroundImage: 'var(--brand-gradient)' }}
                >
                  Su progreso.
                </span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                Entrenamiento, nutrición y seguimiento conectados en un mismo
                lugar. Un espacio de trabajo ágil para ti y una app móvil para
                acompañar a cada cliente en su día a día.
              </p>

              <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
                <Link
                  to="/registro"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-base font-semibold text-white shadow-md shadow-indigo-600/25 transition-colors hover:bg-indigo-700 sm:w-auto"
                >
                  Crear mi cuenta
                  <Icon name="arrow-right" size={18} />
                </Link>
                <a
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-7 py-3.5 text-base font-semibold text-slate-800 transition-colors hover:border-indigo-400 hover:text-indigo-700 sm:w-auto"
                  href="#como-funciona"
                >
                  Ver cómo funciona
                </a>
              </div>

              <ul className="mt-8 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-2 p-0 text-sm font-medium text-slate-600">
                {assurances.map((text) => (
                  <li key={text} className="inline-flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Icon name="check" size={12} strokeWidth={2.5} />
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>
        <ProductFeatures />
        <ConnectedExperience />
        <HowItWorks />
        <Plans />
        <FrequentlyAskedQuestions />

        <section
          className="mx-auto my-24 w-full max-w-6xl px-5 sm:px-8"
          aria-labelledby="closing-title"
        >
          <div
            className="rounded-3xl px-6 py-14 text-center text-white sm:px-16 sm:py-20"
            style={{ background: 'var(--brand-gradient)' }}
          >
            <h2
              id="closing-title"
              className="text-3xl font-bold leading-tight tracking-tight sm:text-5xl"
            >
              El plan lo haces tú.
              <span className="block">La conexión, CouchOne Fit.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">
              Un lugar para planificar. Una forma de estar más cerca.
            </p>
            <Link
              to="/registro"
              className="mt-9 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-indigo-700 shadow-lg transition-colors hover:bg-indigo-50"
            >
              Crear mi cuenta
              <Icon name="arrow-right" size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-14">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
                Entrenamiento, nutrición y seguimiento, con las personas en el
                centro.
              </p>
            </div>
            <nav aria-label="Navegación del pie">
              <p className="mb-4 text-sm font-semibold text-slate-900">
                Producto
              </p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm text-slate-600">
                {footerLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="hover:text-indigo-700 hover:underline"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <p className="mb-4 text-sm font-semibold text-slate-900">
                Tu cuenta
              </p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm text-slate-600">
                <li>
                  <Link
                    to="/acceso"
                    className="hover:text-indigo-700 hover:underline"
                  >
                    Iniciar sesión
                  </Link>
                </li>
                <li>
                  <Link
                    to="/registro"
                    className="hover:text-indigo-700 hover:underline"
                  >
                    Crear cuenta
                  </Link>
                </li>
                <li>
                  <Link
                    to="/recuperar"
                    className="hover:text-indigo-700 hover:underline"
                  >
                    Recuperar acceso
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 text-sm text-slate-500 sm:flex-row">
            <p>© {CURRENT_YEAR} CouchOne Fit. Todos los derechos reservados.</p>
            <p>Hecho para entrenadores y profesionales de la salud.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
