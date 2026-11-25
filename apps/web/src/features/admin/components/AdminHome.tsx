import { useEffect, useState, type ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Badge, Card, PageHeader } from '../../../components/ui';
import { sessionRequest } from '../../auth/services/session';
import type { PlanSaaS, ProfessionalRecord } from '../types/admin';

interface AdminStats {
  professionals: number | null;
  totalPlans: number | null;
  activePlans: number | null;
}

export default function AdminHome({
  username,
}: {
  username: string;
}): ReactElement {
  const [stats, setStats] = useState<AdminStats>({
    professionals: null,
    totalPlans: null,
    activePlans: null,
  });

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      sessionRequest<{ professionals: ProfessionalRecord[]; total: number }>(
        '/api/admin/professionals?page=1&pageSize=1'
      ),
      sessionRequest<{ plans: PlanSaaS[] }>('/api/admin/plans'),
    ]).then(([prosResult, plansResult]) => {
      if (!active) return;
      setStats({
        professionals:
          prosResult.status === 'fulfilled' ? prosResult.value.total : null,
        totalPlans:
          plansResult.status === 'fulfilled'
            ? plansResult.value.plans.length
            : null,
        activePlans:
          plansResult.status === 'fulfilled'
            ? plansResult.value.plans.filter((p) => p.isActive).length
            : null,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        title={`Hola, ${username}.`}
        lead="Tu espacio para supervisar y administrar CouchOne Fit."
      />

      {(stats.professionals !== null || stats.totalPlans !== null) && (
        <div className="ws-stats mb-4" aria-label="Resumen operativo">
          <section className="ws-card" aria-labelledby="admin-kpi-pros">
            <h2 id="admin-kpi-pros" className="ws-stat-label">
              Profesionales registrados
            </h2>
            <p className="ws-stat-value">
              {stats.professionals !== null ? stats.professionals : '—'}
            </p>
            <p className="ws-stat-note">Directorio y estado de suscripciones</p>
          </section>
          <section className="ws-card" aria-labelledby="admin-kpi-plans">
            <h2 id="admin-kpi-plans" className="ws-stat-label">
              Planes activos en catálogo
            </h2>
            <p className="ws-stat-value">
              {stats.activePlans !== null ? stats.activePlans : '—'}
              {stats.totalPlans !== null && (
                <span className="text-base font-medium text-(--ws-muted)">
                  {' '}
                  / {stats.totalPlans}
                </span>
              )}
            </p>
            <p className="ws-stat-note">
              Disponibles para nuevas contrataciones
            </p>
          </section>
        </div>
      )}

      <div className="ws-grid-2">
        <Card
          title="Profesionales"
          subtitle="Directorio, suscripciones y soporte."
          icon="users"
          labelId="admin-professionals"
        >
          <p className="mb-4 text-sm leading-relaxed text-(--ws-text-2)">
            Consulta el directorio de profesionales, su plan y el estado de su
            cuenta. Desde soporte puedes revisar a sus clientes sin editar su
            expediente.
          </p>
          <Link
            to="/admin/profesionales"
            className="ws-btn"
            data-variant="primary"
          >
            Ver profesionales
            <Icon name="arrow-right" size={16} />
          </Link>
        </Card>

        <Card
          title="Catálogo de planes"
          subtitle="Precios y límites vigentes."
          icon="layers"
          labelId="admin-plans"
        >
          <p className="mb-4 text-sm leading-relaxed text-(--ws-text-2)">
            Ajusta el precio y la capacidad de cada plan. Los cambios aplican a
            nuevas contrataciones y renovaciones.
          </p>
          <Link to="/admin/planes" className="ws-btn">
            Gestionar planes
            <Icon name="arrow-right" size={16} />
          </Link>
        </Card>

        <Card
          title="Observabilidad y niveles de servicio"
          subtitle="Métricas reales, logs, SLI, SLO, SLA e incidentes."
          icon="activity"
          labelId="admin-observability"
        >
          <p className="mb-4 text-sm leading-relaxed text-(--ws-text-2)">
            Supervisa la disponibilidad de Web, API y base de datos, explora
            registros operativos, evalúa objetivos SLI/SLO y ejecuta pruebas
            autorizadas.
          </p>
          <Link
            to="/admin/observabilidad"
            className="ws-btn"
            data-variant="primary"
          >
            Abrir observabilidad
            <Icon name="arrow-right" size={16} />
          </Link>
        </Card>
      </div>

      <Card
        title="Gobernanza y seguridad"
        subtitle="Estado de la cuenta administrativa."
        icon="shield"
        labelId="admin-status-title"
        className="mt-4"
      >
        <dl className="ws-dl">
          <div>
            <dt>Rol de la cuenta</dt>
            <dd>
              <Badge tone="info">Administrador</Badge>
            </dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>
              <Badge tone="ok">Activo</Badge>
            </dd>
          </div>
          <div>
            <dt>Sesión</dt>
            <dd>
              <Badge tone="ok">Protegida</Badge>
            </dd>
          </div>
          <div>
            <dt>Expedientes de clientes</dt>
            <dd>Solo lectura desde soporte</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
