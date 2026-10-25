import { useEffect, useState } from 'react';
import { sessionRequest, sessionMutation } from '../../auth/services/session';
import { ApiError } from '../../../services/api';
import type { ProfessionalRecord, PlanSaaS } from '../types/admin';

export default function ProfessionalDirectory() {
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [plans, setPlans] = useState<PlanSaaS[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Estado de edición modal/inline
  const [managingRecord, setManagingRecord] = useState<ProfessionalRecord | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  const fetchDirectory = async () => {
    try {
      const [profsRes, plansRes] = await Promise.all([
        sessionRequest<{ professionals: any[] }>('/api/admin/professionals'),
        sessionRequest<{ plans: PlanSaaS[] }>('/api/admin/plans')
      ]);

      // Mapeo adaptado para transformar los campos de la DB al frontend
      const mappedProfessionals: ProfessionalRecord[] = (profsRes.professionals || []).map((p: any) => {
        return {
          id: p.id,
          fullName: p.firstName ? `${p.firstName} ${p.lastName || ''}`.trim() : (p.fullName || p.email || ''),
          email: p.email || '',
          subscriptionStatus: p.status ?? 'none',
          planName: p.planName ?? 'Sin Plan',
          limit: p.maxClients ?? null,
          clientsUsed: p.usedClients ?? 0,
        } as ProfessionalRecord;
      });

      setProfessionals(mappedProfessionals);
      setPlans(plansRes.plans || []);
    } catch (err) {
      setError('No pudimos cargar el directorio. Intenta recargar.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory();
  }, []);

  async function updateSubscription(action: 'activate' | 'suspend' | 'change_plan') {
    if (!managingRecord) return;
    setError('');
    
    try {
      const payload = action === 'change_plan' 
        ? { planId: selectedPlanId } 
        : { status: action === 'activate' ? 'active' : 'suspended' };
      
      await sessionMutation(`/api/admin/professionals/${managingRecord.id}/subscription`, payload, 'PATCH');
      
      await fetchDirectory();
      setManagingRecord(null);
      setSelectedPlanId('');
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Error al modificar la suscripción.');
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</div>}
      
      {managingRecord && (
        <div className="p-6 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-200 dark:border-indigo-900 mb-6">
          <h3 className="font-bold text-lg mb-2">Gestionar: {managingRecord.fullName}</h3>
          <p className="text-sm mb-4">Uso actual: {managingRecord.clientsUsed} clientes activos.</p>
          
          <div className="flex flex-wrap gap-4 items-end">
            <label className="block flex-1 min-w-[200px]">
              <span className="text-sm font-medium mb-1 block">Cambiar Plan</span>
              <select 
                value={selectedPlanId} 
                onChange={(e) => setSelectedPlanId(e.target.value)} 
                className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900"
              >
                <option value="">Selecciona un plan...</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <button 
              onClick={() => updateSubscription('change_plan')} 
              disabled={!selectedPlanId} 
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              Aplicar Plan
            </button>
            
            <div className="w-px h-10 bg-indigo-200 dark:bg-indigo-800 mx-2 hidden md:block"></div>
            
            {managingRecord.subscriptionStatus === 'suspended' ? (
               <button onClick={() => updateSubscription('activate')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">Reactivar Acceso</button>
            ) : (
               <button onClick={() => updateSubscription('suspend')} className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg font-semibold hover:bg-red-100 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">Suspender Cuenta</button>
            )}
            
            <button onClick={() => setManagingRecord(null)} className="px-4 py-2 text-slate-600 underline">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#0c152c] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? <p className="p-6">Cargando profesionales...</p> : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="p-4">Profesional</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Plan Vigente</th>
                <th className="p-4">Uso de Cupo</th>
                <th className="p-4">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.isArray(professionals) && professionals.map(prof => (
                <tr key={prof.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-4">
                    <p className="font-bold">{prof.fullName}</p>
                    <p className="text-xs text-slate-500">{prof.email}</p>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${prof.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {prof.subscriptionStatus === 'active' ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="p-4 font-medium">{prof.planName}</td>
                  <td className="p-4 font-mono text-xs">
                    {prof.clientsUsed} / {prof.limit !== null && prof.limit !== undefined ? prof.limit : '∞'}
                  </td>
                  <td className="p-4">
                    <button onClick={() => setManagingRecord(prof)} className="text-indigo-600 font-semibold hover:underline">Administrar</button>
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