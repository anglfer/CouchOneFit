import '../marketing.css';
import type { ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { PanelShot, PhoneShot } from '../../../components/ProductShot';
import { MarketingNavigation } from '../components/MarketingNavigation';
import { Hero } from '../components/Hero';
import { TwoSides } from '../components/TwoSides';
import { RecordCoverage } from '../components/RecordCoverage';
import { HowItWorks } from '../components/HowItWorks';
import { Plans } from '../components/Plans';
import { FrequentlyAskedQuestions } from '../components/FrequentlyAskedQuestions';
import { TrackBackdrop } from '../components/TrackBackdrop';

const CURRENT_YEAR = new Date().getFullYear();

const footerColumns = [
  {
    title: 'Producto',
    links: [
      { href: '#producto', label: 'El producto' },
      { href: '#expediente', label: 'Expediente' },
      { href: '#como-funciona', label: 'Cómo funciona' },
      { href: '#planes', label: 'Planes' },
      { href: '#preguntas', label: 'Preguntas frecuentes' },
    ],
  },
  {
    title: 'Tu cuenta',
    links: [
      { to: '/acceso', label: 'Iniciar sesión' },
      { to: '/registro', label: 'Crear cuenta' },
      { to: '/recuperar', label: 'Recuperar acceso' },
      { to: '/registro', label: 'Contáctanos' },
      { to: '/privacidad', label: 'Privacidad y condiciones' },
    ],
  },
];

const footerLink =
  'text-[15px] text-brand-muted transition-colors hover:text-brand-primary';

function Closing(): ReactElement {
  return (
    <section
      aria-labelledby="closing-title"
      className="mx-auto w-full max-w-[1240px] px-4 pb-24 sm:px-8 sm:pb-32"
    >
      <div
        className="mk-on-color relative overflow-hidden rounded-[28px] px-6 py-14 sm:px-12 sm:py-20 xl:flex xl:min-h-[530px] xl:items-center"
        style={{ background: 'var(--brand-gradient)' }}
      >
        <TrackBackdrop variant="brand" />
        <div className="relative z-10 max-w-[28rem]">
          <h2
            id="closing-title"
            className="font-display text-[clamp(2.2rem,1.3rem+2.8vw,3.75rem)] font-semibold leading-[1.03] tracking-[-0.032em] text-white"
          >
            Tus planes. Su progreso.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-indigo-50">
            Crea tu cuenta, registra a tu primer cliente y entrégale su código.
            Eliges tu plan cuando estés listo.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/registro" className="mk-btn" data-variant="inverse">
              Crear mi cuenta
              <Icon name="arrow-right" size={18} />
            </Link>
            <Link
              to="/registro"
              className="mk-btn"
              data-variant="outline-inverse"
            >
              Contáctanos
            </Link>
          </div>
        </div>
        <PanelShot
          screen="panel-expediente"
          alt=""
          className="pointer-events-none absolute right-24 top-14 hidden w-[min(47%,560px)] xl:block"
        />
        <PhoneShot
          screen="movil-progreso"
          alt=""
          className="pointer-events-none absolute right-6 top-28 hidden w-[190px] xl:block"
        />
      </div>
    </section>
  );
}

export default function MarketingPage(): ReactElement {
  return (
    <div className="mk-page min-h-screen bg-white font-sans text-brand-ink antialiased">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-primary focus:px-4 focus:py-2 focus:text-white"
        href="#contenido"
      >
        Saltar al contenido
      </a>
      <MarketingNavigation />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <TwoSides />
        <RecordCoverage />
        <HowItWorks />
        <Plans />
        <FrequentlyAskedQuestions />
        <Closing />
      </main>

      <footer className="border-t border-brand-border bg-brand-surface">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-14 sm:px-8">
          <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-brand-muted">
                Expediente, entrenamiento, alimentación y seguimiento para
                entrenadores y nutriólogos, con la app de sus clientes.
              </p>
            </div>
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-sm font-semibold text-brand-ink">
                  {column.title}
                </h2>
                <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {'to' in link ? (
                        <Link to={link.to} className={footerLink}>
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className={footerLink}>
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-12 flex flex-col justify-between gap-2 border-t border-brand-border pt-6 text-sm text-[#5b6388] sm:flex-row">
            <p>© {CURRENT_YEAR} CouchOne Fit. Todos los derechos reservados.</p>
            <p>
              Las capturas muestran el producto real con datos de demostración.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
