import { useRef, useState, type FormEvent, type ReactElement } from 'react';
import { Brand } from '../../../components/Brand';
import { Link } from '../../../components/Link';
import { ApiError } from '../../../services/api';
import type { Registration } from '../types/registration';
import { registerProfessional } from '../services/registration';
import {
  REGISTRATION_NOTICE,
  NOTICE_VERSION,
  registrationPlans,
} from '../constants/registration';

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
        planInterest: (value('planInterest') || null) as Registration['planInterest'],
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
    <div className="min-h-screen bg-[#f8f9fd] py-6 px-4 sm:px-6 lg:px-8">
      <header className="max-w-6xl mx-auto flex items-center justify-between py-4 mb-6">
        <Brand />
        <div>
          <Link
            to="/"
            className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
          >
            Volver al inicio <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>
      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <aside className="lg:col-span-5 space-y-6 pt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-200/80">
            DA EL SIGUIENTE PASO
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Tu experiencia.
            <span className="block text-slate-400">Un nuevo espacio.</span>
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            Prepara tu cuenta para organizar tus planes y acompañar el progreso
            de tus clientes de forma conectada y profesional.
          </p>
          <div className="p-6 rounded-2xl bg-white border border-indigo-100/90 shadow-xs space-y-2">
            <span className="text-[11px] font-bold tracking-wider text-indigo-600 uppercase">
              {selectedPlan ? 'EL PLAN QUE ELEGISTE' : 'A TU RITMO'}
            </span>
            <h2 className="text-2xl font-bold text-slate-900">
              {selectedPlan?.name ?? 'Empieza por tu cuenta'}
            </h2>
            <p className="text-sm text-slate-600 font-medium">
              {selectedPlan
                ? `$${selectedPlan.price} MXN · ${selectedPlan.capacity}`
                : 'Puedes elegir un plan más adelante.'}
            </p>
            <div className="pt-2">
              <a
                href="/#planes"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1"
              >
                Ver todos los planes →
              </a>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Crear tu cuenta no realiza un cobro ni activa un plan.
          </p>
        </aside>

        <section
          className="lg:col-span-7 p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/80 shadow-xs"
          aria-labelledby="registration-title"
        >
          {isComplete ? (
            <div
              ref={messageRef}
              tabIndex={-1}
              role="status"
              className="space-y-4 py-8 text-center"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                ✓ YA DISTE EL PRIMER PASO
              </span>
              <h2
                id="registration-title"
                className="text-3xl font-extrabold text-slate-900 tracking-tight"
              >
                Tu cuenta está lista.
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                Guardamos tu registro.{' '}
                {selectedPlan
                  ? `Tu interés en ${selectedPlan.name} quedó registrado.`
                  : 'Podrás elegir un plan después.'}{' '}
                No se ha activado una suscripción.
              </p>
              <div className="pt-4">
                <Link
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-600/30"
                  to="/acceso"
                >
                  Ir al acceso <span aria-hidden="true">→</span>
                </Link>
              </div>
              <p className="text-xs text-slate-400">
                Inicia sesión para entrar a tu espacio.
              </p>
            </div>
          ) : (
            <>
              <h2
                id="registration-title"
                className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2"
              >
                Hagamos equipo.
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Cuéntanos lo esencial para empezar. Todos los campos son
                obligatorios, excepto donde se indica.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <fieldset disabled={isSubmitting} className="space-y-4">
                  <legend className="sr-only">Datos de registro</legend>
                  <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                    <span>Nombre completo</span>
                    <input
                      name="fullName"
                      autoComplete="name"
                      required
                      minLength={3}
                      maxLength={240}
                      placeholder="Tu nombre completo"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                      <span>Usuario</span>
                      <input
                        name="username"
                        autoComplete="username"
                        required
                        maxLength={60}
                        aria-describedby="username-help"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                      <span>Teléfono (opcional)</span>
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10,15}"
                        maxLength={15}
                        aria-describedby="phone-help"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <p id="username-help">
                      3–30 letras, números, puntos o guion bajo.
                    </p>
                    <p id="phone-help">
                      10–15 dígitos, sin espacios ni prefijo +.
                    </p>
                  </div>
                  <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                    <span>Correo electrónico</span>
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      placeholder="nombre@correo.com"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                    <span>Confirma tu correo</span>
                    <input
                      name="emailConfirmation"
                      type="email"
                      autoComplete="off"
                      required
                      maxLength={254}
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                      <span>Contraseña</span>
                      <input
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        aria-describedby="password-help"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                      <span>Confirma tu contraseña</span>
                      <input
                        name="passwordConfirmation"
                        type="password"
                        autoComplete="new-password"
                        required
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                      />
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400" id="password-help">
                    15–128 caracteres. Puedes usar una frase; no necesitas
                    combinar mayúsculas, números y símbolos.
                  </p>
                  <label className="block text-xs font-semibold text-slate-700 space-y-1.5">
                    <span>Plan que te interesa (opcional)</span>
                    <select
                      name="planInterest"
                      value={selectedPlanId}
                      onChange={(event) =>
                        setSelectedPlanId(event.target.value)
                      }
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-2 focus:outline-indigo-600 transition-all"
                    >
                      <option value="">Lo elegiré después</option>
                      {registrationPlans.map((plan) => (
                        <option value={plan.id} key={plan.id}>
                          {plan.name} · ${plan.price} MXN
                        </option>
                      ))}
                    </select>
                  </label>
                  <details className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600">
                    <summary className="font-semibold text-slate-800 cursor-pointer">
                      Sobre tu registro
                    </summary>
                    <p className="mt-2 leading-relaxed">
                      {REGISTRATION_NOTICE}
                    </p>
                  </details>
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer pt-1">
                    <input
                      name="acceptsNotice"
                      type="checkbox"
                      required
                      className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <span>He leído la información sobre mi registro.</span>
                  </label>
                  {error && (
                    <p
                      role="alert"
                      className="p-3 rounded-xl text-xs font-medium text-red-700 bg-red-50 border border-red-200"
                    >
                      {error}
                    </p>
                  )}
                  <button
                    className="w-full py-3.5 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-xs shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
                    type="submit"
                  >
                    {isSubmitting
                      ? 'Guardando tu registro…'
                      : 'Crear mi cuenta →'}
                  </button>
                </fieldset>
                <p className="pt-4 text-center text-xs text-slate-500">
                  ¿Ya tienes una cuenta?{' '}
                  <Link
                    to="/acceso"
                    className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
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
