import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Brand } from '../../../components/Brand';
import {
  NOTICE_VERSION,
  PRIVACY_SECTIONS,
  REGISTRATION_NOTICE,
} from '../constants/registration';

/** HU-041: información clara y versionada sobre privacidad y condiciones. */
export default function PrivacyPage(): ReactElement {
  return (
    <div className="ws-auth-shell px-4 py-6 sm:px-6 lg:px-8">
      <header className="mx-auto mb-6 flex w-full max-w-4xl items-center justify-between py-4">
        <Brand />
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-(--ws-muted) transition-colors hover:text-(--ws-primary-fg) sm:text-sm"
        >
          Volver al inicio <Icon name="arrow-up-right" size={14} />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl space-y-6 pb-12">
        <section
          className="ws-auth-card space-y-6 p-6 sm:p-10"
          aria-labelledby="privacy-title"
        >
          <div className="space-y-2 border-b border-(--ws-border-subtle) pb-6">
            <span className="ws-badge" data-tone="info">
              Versión {NOTICE_VERSION}
            </span>
            <h1
              id="privacy-title"
              className="text-3xl font-extrabold tracking-tight text-(--ws-text) sm:text-4xl"
            >
              Privacidad y condiciones de uso
            </h1>
            <p className="text-sm leading-relaxed text-(--ws-text-2)">
              {REGISTRATION_NOTICE}
            </p>
          </div>

          <div className="space-y-5">
            {PRIVACY_SECTIONS.map((section) => (
              <article key={section.title} className="space-y-1.5">
                <h2 className="text-base font-bold text-(--ws-text)">
                  {section.title}
                </h2>
                <p className="text-sm leading-relaxed text-(--ws-text-2)">
                  {section.body}
                </p>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-(--ws-border-subtle) pt-6">
            <Link to="/registro" className="ws-btn" data-variant="primary">
              Crear mi cuenta <Icon name="arrow-right" size={14} />
            </Link>
            <Link to="/acceso" className="ws-btn">
              Iniciar sesión
            </Link>
            <Link to="/" className="ws-btn">
              Volver al portal
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
