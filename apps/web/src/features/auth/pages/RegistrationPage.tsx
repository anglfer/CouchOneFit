import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Brand } from '../../marketing/components/MarketingNavigation';
import { apiClient, ApiError } from '../../../services/api';
import {
  REGISTRATION_NOTICE,
  NOTICE_VERSION,
  registrationPlans,
} from '../content';
import '../../marketing/marketing.css';
import '../registration.css';

export default function RegistrationPage(): ReactElement {
  const requestedPlan = new URLSearchParams(window.location.search).get('plan');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(
    registrationPlans.find((plan) => plan.id === requestedPlan)?.id ?? ''
  );
  const selectedPlan = registrationPlans.find(
    (plan) => plan.id === selectedPlanId
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);
  const messageRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitLock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (name: string) => String(data.get(name) ?? '');
    const password = value('contrasena');
    const email = value('correo').trim().toLowerCase();
    let validationError = '';
    if (email !== value('confirmacionCorreo').trim().toLowerCase())
      validationError = 'Los correos no coinciden.';
    else if ([...password].length < 15 || [...password].length > 128)
      validationError = 'La contraseña debe tener entre 15 y 128 caracteres.';
    else if (password !== value('confirmacionContrasena'))
      validationError = 'Las contraseñas no coinciden.';
    if (validationError) {
      setError(validationError);
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await apiClient('/api/auth/professionals', {
        method: 'POST',
        body: JSON.stringify({
          nombreCompleto: value('nombreCompleto'),
          usuario: value('usuario'),
          correo: email,
          confirmacionCorreo: value('confirmacionCorreo'),
          contrasena: password,
          confirmacionContrasena: value('confirmacionContrasena'),
          telefono: value('telefono'),
          planInteres: value('planInteres') || null,
          avisoVersion: NOTICE_VERSION,
          aceptaAviso: data.get('aceptaAviso') === 'on',
        }),
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
    <div className="marketing registration-page">
      <header className="registration-header marketing-container">
        <Brand />
        <a href="/">Volver al inicio ↗</a>
      </header>
      <main className="registration-layout marketing-container">
        <aside className="registration-intro">
          <span className="marketing-label">DA EL SIGUIENTE PASO</span>
          <h1>
            Tu experiencia.
            <br />
            <span>Un nuevo espacio.</span>
          </h1>
          <p>
            Prepara tu cuenta para organizar tus planes y acompañar el progreso
            de tus clientes.
          </p>
          <div className="registration-plan">
            <span>{selectedPlan ? 'EL PLAN QUE ELEGISTE' : 'A TU RITMO'}</span>
            <h2>{selectedPlan?.name ?? 'Empieza por tu cuenta'}</h2>
            <p>
              {selectedPlan
                ? `$${selectedPlan.price} MXN · ${selectedPlan.capacity}`
                : 'Puedes elegir un plan más adelante.'}
            </p>
            <a href="/#planes">Ver los planes →</a>
          </div>
          <p className="registration-caption">
            Crear tu cuenta no realiza un cobro ni activa un plan.
          </p>
        </aside>
        <section
          className="registration-card"
          aria-labelledby="registration-title"
        >
          {isComplete ? (
            <div
              ref={messageRef}
              tabIndex={-1}
              role="status"
              className="registration-success"
            >
              <span className="marketing-label">YA DISTE EL PRIMER PASO</span>
              <h2 id="registration-title">Tu cuenta está lista.</h2>
              <p>
                Guardamos tu registro.{' '}
                {selectedPlan
                  ? `Tu interés en ${selectedPlan.name} quedó registrado.`
                  : 'Podrás elegir un plan después.'}{' '}
                No se ha activado una suscripción.
              </p>
              <a className="marketing-button" href="/acceso">
                Ir al acceso →
              </a>
              <p>Inicia sesión para entrar a tu espacio.</p>
            </div>
          ) : (
            <>
              <h2 id="registration-title">Hagamos equipo.</h2>
              <p>
                Cuéntanos lo esencial para empezar. Todos los campos son
                obligatorios, excepto donde se indica.
              </p>
              <form onSubmit={submit} className="registration-form">
                <fieldset disabled={isSubmitting}>
                  <legend className="registration-sr-only">
                    Datos de registro
                  </legend>
                  <label>
                    Nombre completo
                    <input
                      name="nombreCompleto"
                      autoComplete="name"
                      required
                      minLength={3}
                      maxLength={240}
                      placeholder="Tu nombre completo"
                    />
                  </label>
                  <div className="registration-fields">
                    <label>
                      Usuario
                      <input
                        name="usuario"
                        autoComplete="username"
                        required
                        maxLength={60}
                        aria-describedby="username-help"
                      />
                    </label>
                    <label>
                      Teléfono (opcional)
                      <input
                        name="telefono"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10,15}"
                        maxLength={15}
                        aria-describedby="phone-help"
                      />
                    </label>
                  </div>
                  <p className="registration-help" id="username-help">
                    Usuario: 3–30 letras, números, puntos o guion bajo.
                  </p>
                  <p className="registration-help" id="phone-help">
                    Teléfono: 10–15 dígitos, sin espacios ni prefijo +.
                  </p>
                  <label>
                    Correo electrónico
                    <input
                      name="correo"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="nombre@correo.com"
                    />
                  </label>
                  <label>
                    Confirma tu correo
                    <input
                      name="confirmacionCorreo"
                      type="email"
                      autoComplete="off"
                      required
                      maxLength={254}
                    />
                  </label>
                  <div className="registration-fields">
                    <label>
                      Contraseña
                      <input
                        name="contrasena"
                        type="password"
                        autoComplete="new-password"
                        required
                        aria-describedby="password-help"
                      />
                    </label>
                    <label>
                      Confirma tu contraseña
                      <input
                        name="confirmacionContrasena"
                        type="password"
                        autoComplete="new-password"
                        required
                      />
                    </label>
                  </div>
                  <p className="registration-help" id="password-help">
                    15–128 caracteres. Puedes usar una frase; no necesitas
                    combinar mayúsculas, números y símbolos.
                  </p>
                  <label>
                    Plan que te interesa (opcional)
                    <select
                      name="planInteres"
                      value={selectedPlanId}
                      onChange={(event) =>
                        setSelectedPlanId(event.target.value)
                      }
                    >
                      <option value="">Lo elegiré después</option>
                      {registrationPlans.map((plan) => (
                        <option value={plan.id} key={plan.id}>
                          {plan.name} · ${plan.price} MXN
                        </option>
                      ))}
                    </select>
                  </label>
                  <details className="registration-notice">
                    <summary>Sobre tu registro</summary>
                    <p>{REGISTRATION_NOTICE}</p>
                  </details>
                  <p className="registration-help">
                    Puedes completar tu perfil más adelante.
                  </p>
                  <label className="registration-consent">
                    <input name="aceptaAviso" type="checkbox" required />
                    <span>He leído la información sobre mi registro.</span>
                  </label>
                  {error && (
                    <p role="alert" className="registration-error">
                      {error}
                    </p>
                  )}
                  <button className="marketing-button" type="submit">
                    {isSubmitting
                      ? 'Guardando tu registro…'
                      : 'Crear mi cuenta →'}
                  </button>
                </fieldset>
                <p className="registration-login">
                  ¿Ya tienes una cuenta? <a href="/acceso">Ir al acceso</a>
                </p>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
