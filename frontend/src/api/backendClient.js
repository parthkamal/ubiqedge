import { store } from '../store/store';
import { clearSession } from '../store/authSlice';

// the single wrapper for the main backend (/api/v1) — named specifically
// (not just "client") since ingestion-service/other services could get
// their own wrapper here later without this one's name becoming ambiguous.
// The one place that knows about base URL, auth header injection, and
// error normalization — hooks/components never call fetch directly, they
// only ever go through the resource-specific functions in api/*.js, which
// all funnel through this one function. See implementation spec §8.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest(method, path, { body, params } = {}) {
  const url = new URL(BASE_URL + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = store.getState().auth.accessToken;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // centralized session-expiry handling: clear auth state here, once —
    // ProtectedRoute reacts to isAuthenticated flipping false and redirects
    // to /login on its own, no imperative navigation needed from here
    store.dispatch(clearSession());
    throw new ApiError(401, 'Session expired — please log in again');
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(', ') : (data?.message ?? 'Request failed');
    throw new ApiError(res.status, message);
  }

  return data;
}
