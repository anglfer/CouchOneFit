import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import {
  Badge,
  Card,
  Meter,
  PageHeader,
  type Tone,
} from '../../../components/ui';
import { firstName, initials } from '../../../utils/personName';
import {
  fetchPortfolioSummary,
  percentLabel,
} from '../../follow-up/services/followUp';
import type { PortfolioFollowUpSummary } from '../../follow-up/types/followUp';
import {
  readTrainingClients,
  relativeDay,
  type TrainingClient,
} from '../../training/services/training';
import type { SubscriptionInfo } from '../types/subscription';

const statusLabel: Record<SubscriptionInfo['status'], string> = {
  active: 'Activa',
  grace: 'En gracia (cobro pendiente)',
  suspended: 'Suspendida',
  expired: 'Vencida',
  none: 'Sin suscripción',
};

const statusTone: Record<SubscriptionInfo['status'], Tone> = {
  active: 'ok',
  grace: 'warn',
  suspended: 'bad',
  expired: 'bad',
  none: 'neutral',
};

const daysSince = (date: string) =>
  Math.round(
    (Date.parse(`${new Date().toLocaleDateString('en-CA')}T12:00:00Z`) -
      Date.parse(`${date}T12:00:00Z`)) /
      86400000
  );

/** Why an active client needs the professional now, most urgent first. */
function attention(c: TrainingClient): [string, string, string] | null {
  const training = `/app/clientes/${c.id}/entrenamiento`;
  if (c.hasDraft && !c.activeRoutine)
    return ['Borrador de rutina sin activar', 'Revisar', training];
  if (!c.activeRoutine) return ['Sin rutina asignada', 'Asignar', training];
  if (!c.lastSession)
    return ['Aún no registra entrenamientos', 'Ver', training];
  if (daysSince(c.lastSession) > 7)
    return [`Sin entrenar ${relativeDay(c.lastSession)}`, 'Ver', training];
  return null;
}

export default function ProfessionalHome({
  fullName,
  subscription,
}: {
  fullName: string;
  subscription: SubscriptionInfo | null;
}): ReactElement {
  const limit = subscription?.isUnlimited ? null : (subscription?.limit ?? 0);
  const active = subscription?.status === 'active';
  const [clients, setClients] = useState<TrainingClient[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [summary, setSummary] = useState<PortfolioFollowUpSummary | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  const [checkInView, setCheckInView] = useState<'recent' | 'pending'>(
    'recent'
  );

  useEffect(() => {
    if (!active) return;
    let live = true;
    void readTrainingClients()
      .then((list) => {
        if (live) {
          setClients(list);
          setFailed(false);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [active, attempt]);

  useEffect(() => {
    if (!active) return;
    let live = true;
    void fetchPortfolioSummary()
      .then((next) => {
        if (live) {
          setSummary(next);
          setSummaryFailed(false);
        }
      })
      .catch(() => {
        if (live) {
          setSummary(null);
          setSummaryFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, [active, summaryAttempt]);

  const activeClients = clients?.filter((c) => c.status === 'active') ?? [];
  const needs = activeClients
    .map((c) => [c, attention(c)] as const)
    .filter(
      (entry): entry is readonly [TrainingClient, [string, string, string]] =>
        !!entry[1]
    );
  const recent = activeClients
    .filter((c) => c.lastSession)
    .sort((a, b) => b.lastSession!.localeCompare(a.lastSession!))
    .slice(0, 6);
  const trainedWeek = activeClients.filter((c) => c.sessionsLast7 > 0).length;
  const withoutRoutine = activeClients.filter((c) => !c.activeRoutine).length;
  // DEC-008: pending = active client without today's check-in; no "reviewed" state exists.
  const checkedToday = activeClients.filter((c) => c.checkInToday).length;
  const recentCheckIns = activeClients
    .filter((c) => c.checkInRecent)
    .sort((a, b) =>
      (b.lastCheckInAt ?? '').localeCompare(a.lastCheckInAt ?? '')
    );
  const pendingToday = activeClients.filter((c) => !c.checkInToday);

  return (
    <>
      <PageHeader
        eyebrow="Panel profesional"
        title={`Hola, ${firstName(fullName)}.`}
        lead="Esto es lo que pasa hoy con tus clientes."
        actions={
          <>
            <Link to="/app/entrenamiento" className="ws-btn">
              <Icon name="layers" size={18} />
              Rutinas
            </Link>
            <Link to="/app/clientes" className="ws-btn" data-variant="primary">
              <Icon name="users" size={18} />
              Ir a clientes
            </Link>
          </>
        }
      />

      {!subscription ? (
        <div className="ws-stats" role="status" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="ws-skeleton h-28" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {subscription.excess > 0 && (
            <p className="ws-alert" data-tone="warn" role="status">
              Exceso: {subscription.excess} clientes. Las nuevas altas y
              reactivaciones están bloqueadas; tus expedientes se conservan.
            </p>
          )}
          {subscription.status !== 'active' && (
            <p className="ws-alert" data-tone="warn">
              Contrata o renueva desde{' '}
              <Link to="/app/suscripcion" className="font-semibold underline">
                Mi suscripción
              </Link>{' '}
              para habilitar tu cartera.
            </p>
          )}

          <div className="ws-stats">
            <section className="ws-card" aria-labelledby="stat-clients">
              <h2 id="stat-clients" className="ws-stat-label">
                Clientes activos
              </h2>
              <p className="ws-stat-value">
                {subscription.used}
                <span className="text-base font-medium text-(--ws-muted)">
                  {' '}
                  /{' '}
                  {subscription.isUnlimited ? 'Ilimitado' : subscription.limit}
                </span>
              </p>
              {limit !== null && limit > 0 && (
                <Meter
                  value={subscription.used}
                  max={limit}
                  label="Uso del cupo de clientes"
                />
              )}
              <p className="ws-stat-note">
                {subscription.remaining === null
                  ? 'Sin límite de clientes en tu plan.'
                  : `${subscription.remaining} plazas libres`}
              </p>
            </section>

            {clients && (
              <>
                <section className="ws-card" aria-labelledby="stat-week">
                  <h2 id="stat-week" className="ws-stat-label">
                    Entrenaron esta semana
                  </h2>
                  <p className="ws-stat-value">
                    {trainedWeek}
                    <span className="text-base font-medium text-(--ws-muted)">
                      {' '}
                      de {activeClients.length}
                    </span>
                  </p>
                  <p className="ws-stat-note">
                    Con al menos un registro en 7 días
                  </p>
                </section>
                <section className="ws-card" aria-labelledby="stat-checkin">
                  <h2 id="stat-checkin" className="ws-stat-label">
                    Check-in de hoy
                  </h2>
                  <p className="ws-stat-value">
                    {checkedToday}
                    <span className="text-base font-medium text-(--ws-muted)">
                      {' '}
                      de {activeClients.length}
                    </span>
                  </p>
                  <p className="ws-stat-note">
                    {activeClients.length - checkedToday === 0
                      ? 'Nadie sin check-in hoy'
                      : `${activeClients.length - checkedToday} sin check-in hoy`}
                  </p>
                </section>
                <section className="ws-card" aria-labelledby="stat-routine">
                  <h2 id="stat-routine" className="ws-stat-label">
                    Sin rutina activa
                  </h2>
                  <p className="ws-stat-value">{withoutRoutine}</p>
                  <p className="ws-stat-note">
                    {withoutRoutine === 0
                      ? 'Todos tus clientes activos tienen rutina'
                      : 'Asígnales una desde su ficha'}
                  </p>
                </section>
              </>
            )}

            {summary && (
              <>
                <section
                  className="ws-card"
                  aria-labelledby="stat-adherence-training"
                >
                  <h2 id="stat-adherence-training" className="ws-stat-label">
                    Adherencia entrenamiento (7 d)
                  </h2>
                  <p className="ws-stat-value">
                    {percentLabel(summary.adherence.training.observedPercent)}
                  </p>
                  <p className="ws-stat-note">
                    {summary.adherence.training.applicableDays === 0
                      ? 'Sin días con plan en 7 días'
                      : `Cobertura ${percentLabel(summary.adherence.training.coveragePercent)}`}
                  </p>
                </section>
                <section
                  className="ws-card"
                  aria-labelledby="stat-adherence-nutrition"
                >
                  <h2 id="stat-adherence-nutrition" className="ws-stat-label">
                    Adherencia alimentación (7 d)
                  </h2>
                  <p className="ws-stat-value">
                    {percentLabel(summary.adherence.nutrition.observedPercent)}
                  </p>
                  <p className="ws-stat-note">
                    {summary.adherence.nutrition.applicableDays === 0
                      ? 'Sin días con plan en 7 días'
                      : `Cobertura ${percentLabel(summary.adherence.nutrition.coveragePercent)}`}
                  </p>
                </section>
              </>
            )}

            <section className="ws-card" aria-labelledby="stat-plan">
              <h2 id="stat-plan" className="ws-stat-label">
                Plan actual
              </h2>
              <p className="ws-stat-value">
                {subscription.planName || 'Sin plan asignado'}
              </p>
              <p className="ws-stat-note flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[subscription.status]}>
                  {statusLabel[subscription.status]}
                </Badge>
                {subscription.expiresAt
                  ? `Hasta el ${new Date(subscription.expiresAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'Sin vigencia'}
              </p>
            </section>
          </div>

          {active && summaryFailed && (
            <div
              role="alert"
              className="ws-alert flex flex-wrap items-center justify-between gap-3"
              data-tone="bad"
            >
              <span>No pudimos consultar los indicadores de adherencia.</span>
              <button
                type="button"
                className="ws-btn"
                onClick={() => {
                  setSummaryFailed(false);
                  setSummaryAttempt((n) => n + 1);
                }}
              >
                Reintentar adherencia
              </button>
            </div>
          )}
        </div>
      )}

      {active && (
        <div className="ws-grid-2 mt-4">
          <Card
            title="Necesitan tu atención"
            subtitle="Clientes activos sin rutina o sin entrenar en la última semana."
            icon="users"
            labelId="home-attention"
          >
            {failed ? (
              <div className="space-y-2">
                <p className="text-sm text-(--ws-muted)">
                  No pudimos consultar el estado de tus clientes.
                </p>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => {
                    setFailed(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : !clients ? (
              <div className="ws-skeleton h-24" />
            ) : needs.length === 0 ? (
              <p className="text-sm text-(--ws-muted)">
                {activeClients.length === 0
                  ? 'Aún no tienes clientes activos. Crea su expediente desde Clientes.'
                  : 'Todo al día: tus clientes activos tienen rutina y entrenan.'}
              </p>
            ) : (
              <ul className="home-list">
                {needs.slice(0, 6).map(([c, [reason, cta, href]]) => (
                  <li key={c.id}>
                    <Link to={href}>
                      <span className="ws-avatar" aria-hidden="true">
                        {initials(c.fullName)}
                      </span>
                      <span className="home-list-text">
                        <strong>{c.fullName}</strong>
                        <span>{reason}</span>
                      </span>
                      <span className="home-list-cta">{cta} →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Check-ins de tus clientes"
            subtitle="Recientes en las últimas 24 h o pendientes de registrar hoy."
            icon="clipboard"
            labelId="home-checkins"
          >
            <div className="mb-3 space-y-2">
              <div
                className="ws-segmented"
                role="group"
                aria-label="Vista de check-ins"
              >
                <button
                  type="button"
                  className="ws-plain"
                  aria-pressed={checkInView === 'recent'}
                  onClick={() => setCheckInView('recent')}
                >
                  Recientes (≤ 24 h)
                </button>
                <button
                  type="button"
                  className="ws-plain"
                  aria-pressed={checkInView === 'pending'}
                  onClick={() => setCheckInView('pending')}
                >
                  Sin check-in hoy
                </button>
              </div>
              {checkInView === 'pending' && (
                <p className="text-xs text-(--ws-muted)">
                  Sin check-in registrado en la fecha local actual del cliente;
                  no indica revisión pendiente.
                </p>
              )}
            </div>
            {failed ? (
              <div className="space-y-2">
                <p className="text-sm text-(--ws-muted)">
                  No pudimos consultar los check-ins.
                </p>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => {
                    setFailed(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : !clients ? (
              <div className="ws-skeleton h-24" />
            ) : checkInView === 'recent' ? (
              recentCheckIns.length === 0 ? (
                <p className="text-sm text-(--ws-muted)">
                  Sin check-ins en las últimas 24 horas.
                </p>
              ) : (
                <ul className="home-list">
                  {recentCheckIns.slice(0, 6).map((c) => (
                    <li key={c.id}>
                      <Link to={`/app/clientes/${c.id}/seguimiento`}>
                        <span className="ws-avatar" aria-hidden="true">
                          {initials(c.fullName)}
                        </span>
                        <span className="home-list-text">
                          <strong>{c.fullName}</strong>
                          <span>
                            {c.checkInToday
                              ? 'Registró su check-in de hoy'
                              : `Último check-in ${relativeDay(c.lastCheckIn!)}`}
                          </span>
                        </span>
                        <span className="home-list-cta">Ver →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : pendingToday.length === 0 ? (
              <p className="text-sm text-(--ws-muted)">
                {activeClients.length === 0
                  ? 'Aún no tienes clientes activos.'
                  : 'Todos tus clientes activos registraron su check-in de hoy.'}
              </p>
            ) : (
              <ul className="home-list">
                {pendingToday.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <Link to={`/app/clientes/${c.id}/seguimiento`}>
                      <span className="ws-avatar" aria-hidden="true">
                        {initials(c.fullName)}
                      </span>
                      <span className="home-list-text">
                        <strong>{c.fullName}</strong>
                        <span>
                          {c.lastCheckIn
                            ? `Último check-in ${relativeDay(c.lastCheckIn)}`
                            : 'Aún sin check-ins registrados'}
                        </span>
                      </span>
                      <span className="home-list-cta">Ver →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Actividad reciente"
            subtitle="Últimos entrenamientos registrados desde el móvil."
            icon="chart"
            labelId="home-recent"
          >
            {failed ? (
              <div className="space-y-2">
                <p className="text-sm text-(--ws-muted)">
                  No pudimos consultar la actividad.
                </p>
                <button
                  type="button"
                  className="ws-btn"
                  onClick={() => {
                    setFailed(false);
                    setAttempt((n) => n + 1);
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : !clients ? (
              <div className="ws-skeleton h-24" />
            ) : recent.length === 0 ? (
              <p className="text-sm text-(--ws-muted)">
                Aún no hay entrenamientos registrados por tus clientes.
              </p>
            ) : (
              <ul className="home-list">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link to={`/app/clientes/${c.id}/entrenamiento`}>
                      <span className="ws-avatar" aria-hidden="true">
                        {initials(c.fullName)}
                      </span>
                      <span className="home-list-text">
                        <strong>{c.fullName}</strong>
                        <span>
                          {c.activeRoutine ?? 'Sin rutina activa'} ·{' '}
                          {c.sessionsLast7} en 7 días
                        </span>
                      </span>
                      <span className="home-list-cta">
                        {relativeDay(c.lastSession!)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {!active && subscription && (
        <div className="ws-grid-2 mt-4">
          <Card
            title="Suscripción"
            subtitle="Plan, renovación y comprobantes."
            icon="card"
            labelId="home-subscription"
          >
            <p className="mb-4 text-sm leading-relaxed text-(--ws-text-2)">
              Con una suscripción vigente verás aquí el estado de tus clientes y
              su actividad.
            </p>
            <Link to="/app/suscripcion" className="ws-btn">
              Gestionar mi suscripción →
            </Link>
          </Card>
        </div>
      )}
    </>
  );
}
