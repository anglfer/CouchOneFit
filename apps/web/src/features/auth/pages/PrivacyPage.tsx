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
    <div className="ws-auth-shell">
      <header className="sg-on-color bg-(--sg-cobalt)">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Brand tone="white" />
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-white underline-offset-4 hover:underline"
          >
            Volver al inicio <Icon name="arrow-up-right" size={14} />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:py-14">
        <section
          className="ws-auth-card space-y-8 pt-8"
          aria-labelledby="privacy-title"
        >
          <div className="space-y-3 border-b-[3px] border-(--sg-ink) pb-8">
            <h1
              id="privacy-title"
              className="sg-display text-[clamp(1.8rem,5vw,2.6rem)] font-bold leading-tight text-(--ws-text)"
            >
              Privacidad y condiciones de uso
            </h1>
            <p className="text-sm font-semibold text-(--ws-text-2)">
              Versión {NOTICE_VERSION}
            </p>
            <p className="max-w-[68ch] text-base leading-relaxed text-(--ws-text-2)">
              {REGISTRATION_NOTICE}
            </p>
          </div>

          <div className="space-y-7">
            {PRIVACY_SECTIONS.map((section) => (
              <article key={section.title} className="space-y-2">
                <h2 className="sg-display text-lg font-bold text-(--ws-text)">
                  {section.title}
                </h2>
                <p className="max-w-[68ch] text-base leading-relaxed text-(--ws-text-2)">
                  {section.body}
                </p>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t-[3px] border-(--sg-ink) pt-8">
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
