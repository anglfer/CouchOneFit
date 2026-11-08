import type { ReactElement } from 'react';
import { Icon } from '../../../components/Icon';
import { Link } from '../../../components/Link';
import { Badge, Card, PageHeader, type Tone } from '../../../components/ui';
import { useOperations } from '../../../hooks/useOperations';
import { usePwa } from '../../../hooks/usePwa';
import type {
  Operation,
  OperationState,
} from '../../../services/offline/outbox';
import {
  confirmNotDuplicate,
  discardOperation,
  dismissDuplicate,
  flushOutbox,
  keepServerVersion,
  reapplyOnServerVersion,
  retryOperation,
} from '../../../services/offline/sync';
import { timeAgo } from '../../../utils/timeAgo';

const states: Record<OperationState, { label: string; tone: Tone }> = {
  pending: { label: 'Por enviar', tone: 'info' },
  syncing: { label: 'Enviando…', tone: 'info' },
  failed: { label: 'No se pudo enviar', tone: 'bad' },
  conflict: { label: 'Conflicto', tone: 'warn' },
  duplicate: { label: 'Posible duplicado', tone: 'warn' },
};

const fieldLabels: Record<string, string> = {
  fullName: 'Nombre completo',
  goal: 'Objetivo',
  birthDate: 'Fecha de nacimiento',
  heightCm: 'Estatura (cm)',
  baseWeightKg: 'Peso base (kg)',
  baseBodyFatPercentage: 'Grasa medida (%)',
  waistCm: 'Cintura (cm)',
  hipCm: 'Cadera (cm)',
  status: 'Estado del expediente',
};

const show = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? 'Sin registrar'
    : value === 'active'
      ? 'Activo'
      : value === 'inactive'
        ? 'Inactivo'
        : typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value);

function Comparison({ operation }: { operation: Operation }): ReactElement {
  if (operation.kind.startsWith('training.'))
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h3>Tu captura</h3>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
            {show(operation.body)}
          </pre>
        </div>
        <div>
          <h3>En el servidor</h3>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
            {show(operation.server)}
          </pre>
        </div>
      </div>
    );
  const mine = Object.entries(operation.body).filter(
    ([key]) => key !== 'version'
  );
  return (
    <table className="mt-2 text-sm">
      <caption className="sr-only">
        Tu cambio frente a lo que hay ahora en el servidor
      </caption>
      <thead>
        <tr>
          <th scope="col">Campo</th>
          <th scope="col">Lo que capturaste</th>
          <th scope="col">En el servidor</th>
        </tr>
      </thead>
      <tbody>
        {mine.map(([key, value]) => (
          <tr key={key}>
            <th scope="row" className="normal-case! tracking-normal!">
              {fieldLabels[key] ?? key}
            </th>
            <td>{show(value)}</td>
            <td>{operation.server ? show(operation.server[key]) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Actions({ operation }: { operation: Operation }): ReactElement | null {
  switch (operation.state) {
    case 'failed':
      return (
        <>
          <button
            type="button"
            onClick={() => void retryOperation(operation.id)}
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => void discardOperation(operation.id)}
          >
            Descartar
          </button>
        </>
      );
    case 'conflict':
      return (
        <>
          <button
            type="button"
            className="bg-indigo-600"
            onClick={() => void reapplyOnServerVersion(operation.id)}
          >
            Aplicar el mío sobre la versión actual
          </button>
          <button
            type="button"
            onClick={() => void keepServerVersion(operation.id)}
          >
            Conservar el del servidor
          </button>
        </>
      );
    case 'duplicate':
      return (
        <>
          <button
            type="button"
            className="bg-indigo-600"
            onClick={() => void confirmNotDuplicate(operation.id)}
          >
            Es otra persona: crear
          </button>
          <button
            type="button"
            onClick={() => void dismissDuplicate(operation.id)}
          >
            Es la misma: descartar el pendiente
          </button>
        </>
      );
    case 'pending':
      return (
        <button
          type="button"
          onClick={() => void discardOperation(operation.id)}
        >
          Descartar
        </button>
      );
    default:
      return null;
  }
}

export default function PendingOperations(): ReactElement {
  const operations = useOperations();
  const { isOnline } = usePwa();
  const waiting = operations.some((item) => item.state === 'pending');

  return (
    <>
      <PageHeader
        eyebrow={isOnline ? 'Sincronización' : 'Sin conexión'}
        title="Pendientes de enviar"
        lead="Los cambios que hiciste sin internet se guardan en este dispositivo y se envían solos al volver la conexión. Aquí ves el estado de cada uno."
        actions={
          <button
            type="button"
            disabled={!isOnline || !waiting}
            onClick={() => void flushOutbox()}
          >
            <Icon name="refresh" size={16} />
            Sincronizar ahora
          </button>
        }
      />
      {operations.length === 0 ? (
        <p className="ws-card ws-empty" role="status">
          No tienes cambios pendientes de enviar.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-3 p-0">
          {operations.map((operation) => {
            const state = states[operation.state];
            return (
              <li key={operation.id}>
                <Card
                  title={operation.label}
                  subtitle={`Capturado ${timeAgo(operation.createdAt)}`}
                  action={<Badge tone={state.tone}>{state.label}</Badge>}
                >
                  {operation.state === 'pending' && (
                    <p className="text-sm text-(--ws-muted)">
                      {!isOnline
                        ? 'Se enviará al volver la conexión.'
                        : operation.dependsOn?.some((id) =>
                              operations.some((item) => item.id === id)
                            )
                          ? 'Se enviará cuando se envíe el cambio anterior de esta rutina.'
                          : 'Se enviará en unos segundos.'}
                    </p>
                  )}
                  {operation.error && operation.state !== 'conflict' && (
                    <p role="alert">{operation.error}</p>
                  )}
                  {operation.state === 'conflict' && (
                    <>
                      <p className="text-sm">
                        Este expediente cambió en otro dispositivo mientras
                        capturabas. No se pisó nada: elige qué conservar.
                      </p>
                      <Comparison operation={operation} />
                    </>
                  )}
                  {operation.state === 'duplicate' && operation.matches && (
                    <div className="text-sm">
                      <p>
                        Ya existe un expediente con este nombre. ¿Es la misma
                        persona?
                      </p>
                      <ul className="mt-2">
                        {operation.matches.map((match) => (
                          <li key={match.id}>
                            <Link
                              to={`/app/clientes/${match.id}`}
                              className="font-semibold text-(--ws-primary-fg) underline"
                            >
                              {match.fullName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Actions operation={operation} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
