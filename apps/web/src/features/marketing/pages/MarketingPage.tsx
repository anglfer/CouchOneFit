import type { ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { SignTitle } from '../../../components/SignTitle';
import { MarketingNavigation } from '../components/MarketingNavigation';
import { Hero } from '../components/Hero';
import { ProductFeatures } from '../components/ProductFeatures';
import { PanelOverview } from '../components/PanelOverview';
import { ConnectedExperience } from '../components/ConnectedExperience';
import { HowItWorks } from '../components/HowItWorks';
import { Plans } from '../components/Plans';
import { FrequentlyAskedQuestions } from '../components/FrequentlyAskedQuestions';

const CURRENT_YEAR = new Date().getFullYear();

const productLinks = [
  { href: '#producto', label: 'Producto' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#planes', label: 'Planes' },
  { href: '#preguntas', label: 'Preguntas frecuentes' },
];
const accountLinks = [
  { to: '/acceso', label: 'Iniciar sesión' },
  { to: '/registro', label: 'Crear cuenta' },
  { to: '/recuperar', label: 'Recuperar acceso' },
  { to: '/registro', label: 'Contáctanos' },
  { to: '/privacidad', label: 'Privacidad y condiciones' },
];
const footerLink =
  'underline-offset-[5px] decoration-(--sg-pink) decoration-2 hover:underline';

export default function MarketingPage(): ReactElement {
  return (
    <div className="sg min-h-screen antialiased">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-(--sg-ink) focus:px-4 focus:py-3 focus:font-bold focus:text-white"
        href="#contenido"
      >
        Saltar al contenido
      </a>
      <MarketingNavigation />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <ProductFeatures />
        <PanelOverview />
        <ConnectedExperience />
        <HowItWorks />
        <Plans />
        <FrequentlyAskedQuestions />

        <section
          className="sg-on-color bg-(--sg-ink) text-white"
          aria-labelledby="closing-title"
        >
          <div className="mx-auto w-full max-w-[1360px] px-4 py-24 sm:px-8 lg:py-32">
            <SignTitle
              as="h2"
              id="closing-title"
              lines={['Empieza con tu', 'primer cliente.']}
              className="text-[clamp(2.1rem,6vw,4.2rem)]"
              colors={{
                fill: '#ffffff',
                gap: 'var(--sg-ink)',
                ringA: 'var(--sg-pink)',
                ringB: 'var(--sg-orange)',
              }}
            />
            <p className="mt-8 max-w-[36rem] text-lg leading-relaxed text-white/85">
              Crea tu cuenta, abre su expediente y envíale su código. Desde ese
              momento, lo que registre llega a tu panel.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to="/registro" className="sg-btn" data-variant="action">
                Crear mi cuenta <Icon name="arrow-right" size={18} />
              </Link>
              <Link to="/acceso" className="sg-btn" data-variant="line-white">
                Iniciar sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white">
        <div className="mx-auto w-full max-w-[1360px] px-4 py-16 sm:px-8">
          <div className="grid gap-12 md:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Brand />
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-(--sg-ink-2)">
                Entrenamiento, alimentación y seguimiento en un mismo
                expediente.
              </p>
            </div>
            <nav aria-label="Producto">
              <p className="sg-display mb-4 text-sm font-bold">Producto</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                {productLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={footerLink}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Tu cuenta">
              <p className="sg-display mb-4 text-sm font-bold">Tu cuenta</p>
              <ul className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                {accountLinks.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className={footerLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="mt-14 flex flex-col justify-between gap-2 border-t-[3px] border-(--sg-ink) pt-6 text-sm text-(--sg-ink-2) sm:flex-row">
            <p>© {CURRENT_YEAR} CouchOne Fit. Todos los derechos reservados.</p>
            <p>Capturas reales del producto con datos de demostración.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
