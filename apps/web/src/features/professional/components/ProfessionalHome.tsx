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
  useEffect(() => {
    if (!active) return;
    let live = true;
    void readTrainingClients()
      .then((list) => live && setClients(list))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [active]);
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
              <p className="text-sm text-(--ws-muted)">
                No pudimos consultar el estado de tus clientes.
              </p>
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
            title="Actividad reciente"
            subtitle="Últimos entrenamientos registrados desde el móvil."
            icon="chart"
            labelId="home-recent"
          >
            {failed ? (
              <p className="text-sm text-(--ws-muted)">
                No pudimos consultar la actividad.
              </p>
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
