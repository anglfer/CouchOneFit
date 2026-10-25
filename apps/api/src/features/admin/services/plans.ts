export interface SaasPlan {
  id: string;
  name: string;
  maxClients: number | null;
  priceMxn: string | number;
  isActive: boolean;
}

export interface PlanPayload {
  name: string;
  maxClients: number | null;
  priceMxn: number;
  isActive?: boolean;
}

// Función auxiliar aislada para extraer el token CSRF sin moverle a otros modulos
const getCsrfToken = () => {
  const match = document.cookie.split('; ').find(row => row.startsWith('cof_csrf='));
  return match ? match.split('=')[1] : '';
};

export async function fetchPlans(): Promise<SaasPlan[]> {
  const response = await fetch('/api/admin/plans', {
    headers: { 'Accept': 'application/json' },
    credentials: 'include'
  });
  if (!response.ok) throw new Error('Error al cargar los planes');
  const data = await response.json();
  return data.plans;
}

export async function createPlan(payload: PlanPayload): Promise<SaasPlan> {
  const response = await fetch('/api/admin/plans', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': getCsrfToken() 
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw data.error; 
  return data.plan;
}

export async function updatePlan(id: string, payload: PlanPayload): Promise<SaasPlan> {
  const response = await fetch(`/api/admin/plans/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-CSRF-Token': getCsrfToken() 
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw data.error;
  return data.plan;
}