import type { ReactElement } from 'react';
import { Link } from '../../../shared/Link';
import { Brand, MarketingNavigation } from '../components/MarketingNavigation';
import { ProductPreview } from '../components/ProductPreview';
import {
  ConnectedExperience,
  FrequentlyAskedQuestions,
  HowItWorks,
  Plans,
  ProductFeatures,
} from '../components/ProductStory';

const CURRENT_YEAR = new Date().getFullYear();

export default function MarketingPage(): ReactElement {
  return (
    <div className="min-h-screen bg-[#f8f9fd] text-slate-900 font-sans antialiased">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-xl focus:shadow-lg focus:outline-none"
        href="#contenido"
      >
        Saltar al contenido
      </a>
      <MarketingNavigation />
      <main id="contenido" tabIndex={-1} className="focus:outline-none">

        <section
          className="relative pt-16 pb-14 bg-gradient-to-b from-indigo-50/60 via-[#f8f9fd] to-[#f8f9fd] border-b border-indigo-100/60"
          aria-labelledby="hero-title"
        >
          <div className="w-[min(1200px,calc(100%-48px))] mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-14 flex flex-col items-center">
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-200/80 shadow-xs">
                  <span
                    className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]"
                    aria-hidden="true"
                  />
                  PARA ENTRENADORES Y NUTRIÓLOGOS
                </span>
              </div>

              <h1
                id="hero-title"
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08] mb-6"
              >
                Tus planes.
                <span className="block sm:inline bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 bg-clip-text text-transparent">
                  {' '}
                  Su progreso.
                </span>
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8 font-normal">
                Entrenamiento, nutrición y seguimiento, conectados en un mismo
                lugar. Un espacio de trabajo ágil para ti y una app móvil para
                acompañar a cada cliente en su día a día.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto mb-7">
                <Link
                  to="/registro"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-md shadow-indigo-600/25 hover:shadow-lg hover:shadow-indigo-600/35 transition-all"
                >
                  Contáctanos y comienza gratis <span aria-hidden="true">→</span>
                </Link>
                <a
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-slate-800 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl shadow-xs transition-all"
                  href="#vista-previa"
                >
                  Explorar el producto <span aria-hidden="true">↓</span>
                </a>
                <a
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-3.5 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50/60 rounded-xl transition-all"
                  href="#como-funciona"
                >
                  Cómo funciona <span aria-hidden="true">↗</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm font-medium text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="text-emerald-500 font-bold"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  Sin tarjeta de crédito requerida
                </span>
                <span
                  className="hidden sm:inline text-slate-300"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="text-emerald-500 font-bold"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  PWA instalable profesional
                </span>
                <span
                  className="hidden sm:inline text-slate-300"
                  aria-hidden="true"
                >
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="text-emerald-500 font-bold"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  App móvil con check-in diario
                </span>
              </div>
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
          className="w-[min(1200px,calc(100%-48px))] mx-auto my-20 p-10 sm:p-16 rounded-3xl bg-gradient-to-br from-indigo-50 via-purple-50 to-indigo-100/50 border border-indigo-200/70 text-center shadow-xs"
          aria-labelledby="closing-title"
        >
          <h2
            id="closing-title"
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4"
          >
            El plan lo haces tú.
            <span className="block text-indigo-600">
              La conexión, CouchOne Fit.
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto mb-8 font-normal">
            Un lugar para planificar. Una forma de estar más cerca.
          </p>
          <Link
            to="/registro"
            className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-md shadow-indigo-600/25 transition-all"
          >
            Contáctanos <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <footer className="border-t border-slate-200/80 bg-white py-12">
        <div className="w-[min(1200px,calc(100%-48px))] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start mb-10">
            <div>
              <Brand />
              <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                Entrenamiento, nutrición y seguimiento.
                <br />
                Con las personas en el centro.
              </p>
            </div>
            <nav
              aria-label="Navegación del pie"
              className="flex flex-col sm:flex-row gap-4 sm:gap-6 text-sm font-medium text-slate-600"
            >
              <a
                href="#producto"
                className="hover:text-indigo-600 transition-colors"
              >
                El producto
              </a>
              <a
                href="#como-funciona"
                className="hover:text-indigo-600 transition-colors"
              >
                Cómo funciona
              </a>
              <a
                href="#planes"
                className="hover:text-indigo-600 transition-colors"
              >
                Planes
              </a>
              <a
                href="#preguntas"
                className="hover:text-indigo-600 transition-colors"
              >
                Preguntas frecuentes
              </a>
            </nav>
            <div className="flex justify-start md:justify-end">
              <img
                className="w-16 h-16 rounded-xl shadow-xs"
                src="/pwa-192x192.png"
                alt="Logo de CouchOne Fit"
                width="64"
                height="64"
                loading="lazy"
              />
            </div>
          </div>
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400">
            <p>© {CURRENT_YEAR} CouchOne Fit. Todos los derechos reservados.</p>
            <p>Hecho para entrenadores y profesionales de la salud.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
