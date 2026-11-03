import { ApiError } from '../api';

/** Sin red o servidor inalcanzable: el único caso en que se usa lo guardado o se encola. */
export const isConnectionFailure = (error: unknown): boolean =>
  error instanceof TypeError ||
  (error instanceof ApiError && [502, 503, 504].includes(error.status));
