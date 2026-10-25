import { useEffect, useState } from 'react';
import { sessionRequest, sessionMutation } from '../../auth/services/session';
import { ApiError } from '../../../services/api';

interface ClientAccessRecord {
  clientId: string;
  fullName: string;
  clientStatus: string;
  invitationId?: string;
  invitationCreatedAt?: string;
  invitationExpiresAt?: string;
  invitationStatus: 'pending' | 'active' | 'expired';
}

export default function ClientAccess() {
  const [clients, setClients] = useState<ClientAccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatedTokens, setGeneratedTokens] = useState<Record<string, string>>({});

  const fetchClients = async () => {
    try {
      const res = await sessionRequest<{ clients: ClientAccessRecord[] }>('/api/professional/client-access');
      setClients(res.clients || []);
    } catch (err) {
      setError('No pudimos cargar la lista de expedientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  async function handleGenerateInvitation(clientId: string) {
    setError('');
    try {
      const res = await sessionMutation<{ success: boolean; token: string }>(
        '/api/professional/client-access/invite',
        { clientId },
        'POST'
      );

      // Guardar el token devuelto para mostrarlo en pantalla
      setGeneratedTokens(prev => ({ ...prev, [clientId]: res.token }));
      await fetchClients();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('No se pudo generar el acceso.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Informativo */}
      <div className="p-6 bg-slate-900/60 dark:bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-200">
        <h2 className="text-xl font-bold mb-2">Acceso a expedientes</h2>
        <p className="text-sm text-slate-300">
          Entrega una invitación privada al cliente de un expediente preparado. Reemplazarla invalida inmediatamente el código anterior. Se requiere expediente, profesional y suscripción activos.
        </p>
      </div>

      {error && <div className="p-4 bg-red-900/40 border border-red-800 text-red-300 rounded-xl">{error}</div>}

      <div className="bg-white dark:bg-[#0c152c] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <p className="p-6 text-slate-400">Cargando expedientes...</p>
        ) : clients.length === 0 ? (
          <p className="p-6 text-slate-400">No hay expedientes preparados en tu cartera.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-400">
              <tr>
                <th className="p-4">Cliente</th>
                <th className="p-4">Estado Expediente</th>
                <th className="p-4">Estado Invitación</th>
                <th className="p-4">Código / Código Generado</th>
                <th className="p-4">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {clients.map(client => (
                <tr key={client.clientId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-4 font-semibold">{client.fullName}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      client.clientStatus === 'active' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'
                    }`}>
                      {client.clientStatus === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                      client.invitationStatus === 'active' 
                        ? 'bg-blue-900/40 text-blue-300' 
                        : client.invitationStatus === 'expired' 
                        ? 'bg-amber-900/40 text-amber-300' 
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {client.invitationStatus === 'active' ? 'Vigente' : client.invitationStatus === 'expired' ? 'Expirada' : 'Sin Invitación'}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-xs">
                    {generatedTokens[client.clientId] ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-800 p-2 rounded text-emerald-400 select-all font-bold">
                          {generatedTokens[client.clientId]}
                        </span>
                        <button 
                          onClick={() => navigator.clipboard.writeText(generatedTokens[client.clientId])}
                          className="text-xs text-indigo-400 hover:underline"
                        >
                          Copiar
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-500">
                        {client.invitationExpiresAt ? `Expira: ${new Date(client.invitationExpiresAt).toLocaleDateString()}` : '—'}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleGenerateInvitation(client.clientId)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-lg transition"
                    >
                      {client.invitationId ? 'Regenerar Invitación' : 'Generar Invitación'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}