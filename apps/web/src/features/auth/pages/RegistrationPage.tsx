import { Icon } from '../../../components/Icon';
import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Link } from '../../../components/Link';
import { ApiError } from '../../../services/api';
import { usePlanCatalog } from '../../../hooks/usePlanCatalog';
import { formatPlanPrice, planCapacity } from '../../../services/planCatalog';
import { registerProfessional } from '../services/registration';
import { REGISTRATION_NOTICE, NOTICE_VERSION } from '../constants/registration';

export default function RegistrationPage(): ReactElement {
  const {
    plans,
    loading: catalogLoading,
    error: catalogError,
    reload: reloadCatalog,
  } = usePlanCatalog();
  const requestedPlan = new URLSearchParams(window.location.search).get('plan');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    requestedPlan ?? ''
  );
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);
  const messageRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitLock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? '');
    const password = value('password');
    const email = value('email').trim().toLowerCase();
    let validationError = '';
    if (email !== value('emailConfirmation').trim().toLowerCase())
      validationError = 'Los correos no coinciden.';
    else if ([...password].length < 15 || [...password].length > 128)
      validationError = 'La contraseña debe tener entre 15 y 128 caracteres.';
    else if (password !== value('passwordConfirmation'))
      validationError = 'Las contraseñas no coinciden.';
    if (validationError) {
      setError(validationError);
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await registerProfessional({
        fullName: value('fullName'),
        username: value('username'),
        email,
        emailConfirmation: value('emailConfirmation'),
        password,
        passwordConfirmation: value('passwordConfirmation'),
        phone: value('phone'),
        planInterest: null,
        planInterestId: selectedPlan?.id ?? null,
        noticeVersion: NOTICE_VERSION,
        acceptsNotice: data.get('acceptsNotice') === 'on',
      });
      form.reset();
      setIsComplete(true);
      requestAnimationFrame(() => messageRef.current?.focus());
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.'
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="ws-auth-shell px-4 py-6 sm:px-6 lg:px-8">
      <header className="mx-auto mb-6 flex w-full max-w-6xl items-center justify-between py-4">
        <Brand />
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-(--ws-muted) transition-colors hover:text-(--ws-primary-fg) sm:text-sm"
          >
            Volver al inicio <Icon name="arrow-up-right" size={14} />
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-12">
        <aside className="space-y-6 pt-4 lg:col-span-5">
          <span className="ws-badge" data-tone="info">
            Registro profesional
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-(--ws-text) sm:text-5xl">
            Tu experiencia.
            <span className="block text-(--ws-primary-fg)">
              Un nuevo espacio.
            </span>
          </h1>
          <p className="text-base leading-relaxed text-(--ws-text-2)">
            Prepara tu cuenta para organizar tus planes y acompañar el progreso
            de tus clientes de forma conectada y profesional.
          </p>
          <div className="ws-card space-y-2 p-6!">
            <span className="text-xs font-semibold text-(--ws-primary-fg)">
              {selectedPlan ? 'Plan seleccionado' : 'A tu ritmo'}
            </span>
            <h2 className="text-2xl font-bold text-(--ws-text)">
              {selectedPlan?.name ?? 'Empieza por tu cuenta'}
            </h2>
            <p className="text-sm font-medium text-(--ws-muted)">
              {selectedPlan
                ? `${formatPlanPrice(selectedPlan.priceMxn)} MXN · ${planCapacity(selectedPlan)}`
                : 'Puedes elegir un plan más adelante.'}
            </p>
            <div className="pt-2">
              <a
                href="/#planes"
                className="inline-flex items-center gap-1 text-xs font-semibold text-(--ws-primary-fg) hover:underline"
              >
                Ver todos los planes <Icon name="arrow-right" size={14} />
              </a>
            </div>
          </div>
          <p className="text-sm text-(--ws-muted)">
            Crear tu cuenta no realiza un cobro ni activa un plan.
          </p>
        </aside>

        <section
          className="ws-auth-card p-6 sm:p-10 lg:col-span-7"
          aria-labelledby="registration-title"
        >
          {isComplete ? (
            <div
              ref={messageRef}
              tabIndex={-1}
              role="status"
              className="space-y-4 py-8 text-center"
            >
              <span className="ws-badge" data-tone="ok">
                Registro completado
              </span>
              <h2
                id="registration-title"
                className="text-3xl font-extrabold tracking-tight text-(--ws-text)"
              >
                Tu cuenta está lista.
              </h2>
              <p className="mx-auto max-w-md text-sm text-(--ws-muted)">
                Guardamos tu registro.{' '}
                {selectedPlan
                  ? `Tu interés en ${selectedPlan.name} quedó registrado.`
                  : 'Podrás elegir un plan después.'}{' '}
                No se ha activado una suscripción.
              </p>
              <div className="pt-4">
                <Link
                  className="ws-btn min-h-11"
                  data-variant="primary"
                  to={`/acceso?retorno=${encodeURIComponent('/app/suscripcion')}`}
                >
                  Ir al acceso <Icon name="arrow-right" size={14} />
                </Link>
              </div>
              <p className="text-sm text-(--ws-muted)">
                Inicia sesión para entrar a tu espacio.
              </p>
            </div>
          ) : (
            <>
              <h2
                id="registration-title"
                className="mb-2 text-2xl font-extrabold tracking-tight text-(--ws-text) sm:text-3xl"
              >
                Hagamos equipo.
              </h2>
              <p className="mb-6 text-base text-(--ws-muted)">
                Cuéntanos lo esencial para empezar. Todos los campos son
                obligatorios, excepto donde se indica.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <fieldset disabled={isSubmitting} className="space-y-4">
                  <legend className="sr-only">Datos de registro</legend>
                  <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                    <span>Nombre completo</span>
                    <input
                      name="fullName"
                      autoComplete="name"
                      required
                      minLength={3}
                      maxLength={240}
                      placeholder="Tu nombre completo"
                      className="ws-auth-input"
                    />
                  </label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                      <span>Usuario</span>
                      <input
                        name="username"
                        autoComplete="username"
                        required
                        maxLength={60}
                        aria-describedby="username-help"
                        className="ws-auth-input"
                      />
                      <span
                        id="username-help"
                        className="block text-xs font-normal text-(--ws-muted)"
                      >
                        3–30 letras, números, puntos o guion bajo.
                      </span>
                    </label>
                    <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                      <span>Teléfono (opcional)</span>
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10,15}"
                        maxLength={15}
                        aria-describedby="phone-help"
                        className="ws-auth-input"
                      />
                      <span
                        id="phone-help"
                        className="block text-xs font-normal text-(--ws-muted)"
                      >
                        10–15 dígitos, sin espacios ni prefijo +.
                      </span>
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                      <span>Correo electrónico</span>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        placeholder="nombre@correo.com"
                        className="ws-auth-input"
                      />
                    </label>
                    <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                      <span>Confirma tu correo</span>
                      <input
                        name="emailConfirmation"
                        type="email"
                        autoComplete="off"
                        required
                        maxLength={254}
                        className="ws-auth-input"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                      <span>Contraseña</span>
                      <div className="relative">
                        <input
                          name="password"
                          type={showPasswords ? 'text' : 'password'}
                          autoComplete="new-password"
                          required
                          aria-describedby="password-help"
                          className="ws-auth-input pr-20!"
                        />
                        <button
                          type="button"
                          aria-pressed={showPasswords}
                          onClick={() => setShowPasswords((v) => !v)}
                          className="ws-plain absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2.5 py-1 text-xs font-semibold text-(--ws-primary-fg) hover:bg-(--ws-selected)"
                        >
                          {showPasswords ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                    </label>
                    <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                      <span>Confirma tu contraseña</span>
                      <input
                        name="passwordConfirmation"
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete="new-password"
                        required
                        className="ws-auth-input"
                      />
                    </label>
                  </div>
                  <p className="text-xs text-(--ws-muted)" id="password-help">
                    15–128 caracteres. Puedes usar una frase; no necesitas
                    combinar mayúsculas, números y símbolos.
                  </p>
                  <label className="block space-y-1.5 text-sm font-semibold text-(--ws-text-2)">
                    <span>Plan que te interesa (opcional)</span>
                    <select
                      name="planInterestId"
                      value={selectedPlan?.id ?? ''}
                      disabled={catalogLoading}
                      onChange={(event) =>
                        setSelectedPlanId(event.target.value)
                      }
                      className="ws-auth-input"
                    >
                      <option value="">Lo elegiré después</option>
                      {plans.map((plan) => (
                        <option value={plan.id} key={plan.id}>
                          {plan.name} · {formatPlanPrice(plan.priceMxn)} MXN
                        </option>
                      ))}
                    </select>
                  </label>
                  {catalogError && (
                    <p role="alert" className="ws-alert" data-tone="bad">
                      {catalogError}{' '}
                      <button
                        type="button"
                        className="ws-btn ml-2"
                        onClick={reloadCatalog}
                      >
                        Reintentar planes
                      </button>
                    </p>
                  )}
                  <details className="rounded-xl border border-(--ws-border) bg-(--ws-surface-2) p-4 text-sm text-(--ws-text-2)">
                    <summary className="cursor-pointer font-semibold text-(--ws-text)">
                      Sobre tu registro
                    </summary>
                    <p className="mt-2 leading-relaxed">
                      {REGISTRATION_NOTICE}
                    </p>
                  </details>
                  <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-sm text-(--ws-text-2)">
                    <input
                      name="acceptsNotice"
                      type="checkbox"
                      required
                      className="mt-0.5 h-5 w-5 rounded accent-(--ws-primary)"
                    />
                    <span>He leído la información sobre mi registro.</span>
                  </label>
                  {error && (
                    <p role="alert" className="ws-alert" data-tone="bad">
                      {error}
                    </p>
                  )}
                  <button
                    className="ws-btn min-h-12 w-full text-base"
                    data-variant="primary"
                    type="submit"
                  >
                    {isSubmitting
                      ? 'Guardando tu registro…'
                      : 'Crear mi cuenta'}
                  </button>
                </fieldset>
                <p className="pt-4 text-center text-sm text-(--ws-muted)">
                  ¿Ya tienes una cuenta?{' '}
                  <Link
                    to={`/acceso?retorno=${encodeURIComponent('/app/suscripcion')}`}
                    className="inline-flex items-center gap-1 font-semibold text-(--ws-primary-fg) hover:underline"
                  >
                    Ir al acceso
                  </Link>
                </p>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
