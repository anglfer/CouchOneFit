import { useRef, type ReactElement } from 'react';
import {
	AccessDialog,
	Brand,
	MarketingNavigation,
} from '../components/MarketingNavigation';
import { ProductPreview } from '../components/ProductPreview';
import {
	ConnectedExperience,
	FrequentlyAskedQuestions,
	HowItWorks,
	Plans,
	ProductFeatures,
} from '../components/ProductStory';
import '../marketing.css';

const CURRENT_YEAR = new Date().getFullYear();

export default function MarketingPage(): ReactElement {
  const accessDialogRef = useRef<HTMLDialogElement>(null);

  function openAccessDialog(): void {
    accessDialogRef.current?.showModal();
  }

  return (
    <div className="marketing">
      <a className="marketing-skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <MarketingNavigation onOpenAccess={openAccessDialog} />
      <main id="contenido" tabIndex={-1}>
        <section className="marketing-hero" aria-labelledby="hero-title">
          <div className="marketing-container">
            <div className="hero-heading">
              <div>
                <p className="marketing-label">
                  PARA ENTRENADORES Y NUTRIÓLOGOS
                </p>
                <h1 id="hero-title">
                  Tus planes.
                  <br />
                  <span>Su progreso.</span>
                </h1>
              </div>
              <div className="hero-intro">
                <p>
                  Entrenamiento, nutrición y seguimiento, conectados. Un espacio
                  para ti y una app para acompañar a cada cliente.
                </p>
                <div className="hero-actions">
                  <a className="marketing-button" href="#vista-previa">
                    Explorar el producto <span aria-hidden="true">→</span>
                  </a>
                  <a className="hero-secondary" href="#como-funciona">
                    Cómo funciona <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </div>
            <ProductPreview />
          </div>
        </section>
        <ProductFeatures />
        <ConnectedExperience />
        <HowItWorks />
        <Plans onOpenAccess={openAccessDialog} />
        <FrequentlyAskedQuestions />
        <section
          className="marketing-container closing-section"
          aria-labelledby="closing-title"
        >
          <h2 id="closing-title">
            El plan lo haces tú.
            <br />
            <span>La conexión, CouchOne Fit.</span>
          </h2>
          <p>Un lugar para planificar. Una forma de estar más cerca.</p>
          <a href="#vista-previa" className="marketing-button">
            Explorar el producto <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>
      <footer className="marketing-footer">
        <div className="marketing-container">
          <div className="footer-top">
            <div>
              <Brand />
              <p>
                Entrenamiento, nutrición y seguimiento.
                <br />
                Con las personas en el centro.
              </p>
            </div>
            <nav aria-label="Navegación del pie">
              <a href="#producto">El producto</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#planes">Planes</a>
              <a href="#preguntas">Preguntas frecuentes</a>
            </nav>
            <img
              className="footer-logo"
              src="/logo.png"
              alt="Logo de CouchOne Fit"
              width="1254"
              height="1254"
              loading="lazy"
            />
          </div>
          <div className="footer-bottom">
            <span>© {CURRENT_YEAR} CouchOne Fit</span>
            <span>Producto en desarrollo. Construido para acompañar.</span>
            <a href="#contenido">
              Volver arriba <span aria-hidden="true">↑</span>
            </a>
          </div>
        </div>
      </footer>
      <AccessDialog dialogRef={accessDialogRef} />
    </div>
  );
}
