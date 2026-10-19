import { apiClient } from '../../../services/api';
import type { Registration } from '../types/registration';

export function registerProfessional(data: Registration): Promise<unknown> {
  return apiClient('/api/auth/professionals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
