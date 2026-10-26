import { useEffect, useState } from 'react';
import { sessionRequest } from '../../auth/services/session';

import type { ProfessionalRecord } from '../types/admin';
const labels = {
  active: 'Activa',
  suspended: 'Suspendida',
  expired: 'Vencida',
  none: 'Sin suscripción',
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
    <section className="space-y-6">
      <h2 className="text-xl font-bold">Profesionales y suscripciones</h2>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((n) => n + 1)}>Reintentar</button>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        <label>
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
        <p role="status">Cargando profesionales…</p>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-2xl">
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
                      {pro.fullName}
                      <p>{pro.email}</p>
                    </td>
                    <td className="p-4">
                      {pro.accountStatus === 'active' ? 'Activa' : 'Inactiva'}
                    </td>
                    <td className="p-4">{labels[pro.subscriptionStatus]}</td>
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
            <p>No hay profesionales con estos filtros.</p>
          )}
          <div className="flex gap-4 items-center">
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
