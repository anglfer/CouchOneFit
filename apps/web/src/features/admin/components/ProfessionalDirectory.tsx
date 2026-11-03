import { useEffect, useState } from 'react';
import { sessionRequest } from '../../auth/services/session';

import { Badge, type Tone } from '../../../components/ui';
import type { ProfessionalRecord } from '../types/admin';
const labels = {
  active: 'Activa',
  suspended: 'Suspendida',
  grace: 'En gracia',
  expired: 'Vencida',
  none: 'Sin suscripción',
};
const tones: Record<ProfessionalRecord['subscriptionStatus'], Tone> = {
  active: 'ok',
  grace: 'warn',
  suspended: 'bad',
  expired: 'bad',
  none: 'neutral',
};
interface Directory {
  professionals: ProfessionalRecord[];
  total: number;
}
export default function ProfessionalDirectory() {
  const [directory, setDirectory] = useState<Directory>({
    professionals: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;

    const query = new URLSearchParams({
      page: String(page),
      pageSize: '20',
      search,
      status,
    });
    const refresh = () =>
      void sessionRequest<Directory>(`/api/admin/professionals?${query}`)
        .then((result) => {
          if (active) {
            setDirectory(result);

            setError('');
          }
        })
        .catch(() => {
          if (active) setError('No pudimos cargar el directorio.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    const foreground = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    const timer = window.setInterval(foreground, 60000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', foreground);
      document.removeEventListener('visibilitychange', foreground);
      active = false;
    };
  }, [page, search, status, attempt]);
  return (
    <section className="space-y-4">
      <div className="ws-page-header">
        <div>
          <span className="ws-eyebrow">Directorio</span>
          <h1 className="ws-title">Profesionales y suscripciones</h1>
        </div>
      </div>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      <div className="ws-card flex flex-wrap items-end gap-4 p-4!">
        <label className="min-w-56 flex-1">
          Buscar por nombre o correo
          <input
            className="block border rounded-lg p-2"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Suscripción
          <select
            className="block border rounded-lg p-2"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            {Object.entries(labels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <div className="space-y-3" role="status" aria-busy="true">
          <span className="sr-only">Cargando profesionales…</span>
          <div className="ws-skeleton h-14" />
          <div className="ws-skeleton h-14" />
          <div className="ws-skeleton h-14" />
        </div>
      ) : (
        <>
          <div className="ws-card overflow-x-auto p-0!">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  {[
                    'Profesional',
                    'Cuenta',
                    'Suscripción',
                    'Plan',
                    'Activos / límite',
                    'Inactivos',
                    'Vigencia',
                  ].map((h) => (
                    <th key={h} className="p-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {directory.professionals.map((pro) => (
                  <tr key={pro.id} className="border-t">
                    <td className="p-4">
                      <span className="font-semibold">{pro.fullName}</span>
                      <p className="text-xs text-(--ws-muted)">{pro.email}</p>
                    </td>
                    <td className="p-4">
                      <Badge
                        tone={pro.accountStatus === 'active' ? 'ok' : 'neutral'}
                      >
                        {pro.accountStatus === 'active' ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge tone={tones[pro.subscriptionStatus]}>
                        {labels[pro.subscriptionStatus]}
                      </Badge>
                    </td>
                    <td className="p-4">{pro.planName ?? 'Sin plan'}</td>
                    <td className="p-4">
                      {pro.clientsUsed} /{' '}
                      {pro.isUnlimited ? 'Ilimitado' : (pro.limit ?? 0)}
                    </td>
                    <td className="p-4">{pro.inactiveClients}</td>
                    <td className="p-4">
                      {pro.expiresAt
                        ? new Date(pro.expiresAt).toLocaleString('es-MX')
                        : 'Sin vigencia'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!directory.professionals.length && (
            <p className="ws-card ws-empty">
              No hay profesionales con estos filtros.
            </p>
          )}
          <div className="flex items-center justify-end gap-4 text-sm text-(--ws-muted)">
            <button
              disabled={page === 1}
              onClick={() => {
                setPage((n) => n - 1);
              }}
            >
              Anterior
            </button>
            <span>
              Página {page} · {directory.total} profesionales
            </span>
            <button
              disabled={page * 20 >= directory.total}
              onClick={() => {
                setPage((n) => n + 1);
              }}
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </section>
  );
}
