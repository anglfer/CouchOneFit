import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import {
  Badge,
  Card,
  Meter,
  PageHeader,
  type Tone,
} from '../../../components/ui';
import { firstName } from '../../../utils/personName';
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

export default function ProfessionalHome({
  fullName,
  subscription,
}: {
  fullName: string;
  subscription: SubscriptionInfo | null;
}): ReactElement {
  const limit = subscription?.isUnlimited ? null : (subscription?.limit ?? 0);

  return (
    <>
      <PageHeader
        eyebrow="Panel profesional"
        title={`Hola, ${firstName(fullName)}.`}
        lead="Bienvenido a tu espacio de trabajo en CouchOne Fit."
        actions={
          <Link to="/app/clientes" className="ws-btn" data-variant="primary">
            <Icon name="users" size={18} />
            Ir a clientes
          </Link>
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

            <section className="ws-card" aria-labelledby="stat-plan">
              <h2 id="stat-plan" className="ws-stat-label">
                Plan actual
              </h2>
              <p className="ws-stat-value">
                {subscription.planName || 'Sin plan asignado'}
              </p>
              <p className="ws-stat-note">
                <Badge tone={statusTone[subscription.status]}>
                  {statusLabel[subscription.status]}
                </Badge>
              </p>
            </section>

            <section className="ws-card" aria-labelledby="stat-term">
              <h2 id="stat-term" className="ws-stat-label">
                Vigencia
              </h2>
              <p className="ws-stat-value text-[20px]!">
                {subscription.expiresAt
                  ? new Date(subscription.expiresAt).toLocaleDateString(
                      'es-MX',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )
                  : 'Sin vigencia'}
              </p>
              <p className="ws-stat-note">
                {subscription.expiresAt
                  ? `Hasta ${new Date(subscription.expiresAt).toLocaleString('es-MX')}`
                  : 'Aún no tienes una suscripción vigente.'}
              </p>
            </section>
          </div>
        </div>
      )}

      <div className="ws-grid-2 mt-4">
        <Card
          title="Tu cartera"
          subtitle="Expedientes e invitaciones de tus clientes."
          icon="users"
          labelId="home-portfolio"
        >
          <p className="mb-4 text-sm leading-relaxed text-(--ws-text-2)">
            Consulta el acceso de los expedientes preparados y entrega sus
            invitaciones. La disponibilidad depende de tu suscripción vigente.
          </p>
          <Link to="/app/clientes" className="ws-btn">
            Acceso de clientes
            <Icon name="arrow-right" size={16} />
          </Link>
        </Card>

        <Card
          title="Suscripción"
          subtitle="Plan, renovación y comprobantes."
          icon="card"
          labelId="home-subscription"
        >
          <p className="mb-4 text-sm leading-relaxed text-(--ws-text-2)">
            Cambia de plan, revisa tu historial de pagos y gestiona la
            renovación automática.
          </p>
          <Link to="/app/suscripcion" className="ws-btn">
            Gestionar mi suscripción →
          </Link>
        </Card>
      </div>
    </>
  );
}
