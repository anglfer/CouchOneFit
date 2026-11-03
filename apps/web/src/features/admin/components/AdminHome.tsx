import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Badge, Card, PageHeader } from '../../../components/ui';

export default function AdminHome({
  username,
}: {
  username: string;
}): ReactElement {
  return (
    <>
      <PageHeader
        eyebrow="Administración central"
        title={`Hola, ${username}.`}
        lead="Tu espacio para supervisar y administrar CouchOne Fit."
      />

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
            <dt>Aislamiento de sesiones</dt>
            <dd>
              <Badge tone="ok">HttpOnly + CSRF</Badge>
            </dd>
          </div>
          <div>
            <dt>Permisos profesionales</dt>
            <dd>Separados (403 automático)</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
