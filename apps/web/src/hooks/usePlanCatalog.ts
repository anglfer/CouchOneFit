import { useEffect, useState } from 'react';
import { readPlanCatalog, type CatalogPlan } from '../services/planCatalog';
export function usePlanCatalog() {
  const [plans, setPlans] = useState<CatalogPlan[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true,
      inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const result = await readPlanCatalog();
        if (active) {
          setPlans(result.plans);
          setError('');
        }
      } catch {
        if (active)
          setError('No pudimos actualizar los planes. Inténtalo de nuevo.');
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    const foreground = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    const timer = window.setInterval(foreground, 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', foreground);
      document.removeEventListener('visibilitychange', foreground);
    };
  }, [attempt]);
  return { plans, loading, error, reload: () => setAttempt((n) => n + 1) };
}
