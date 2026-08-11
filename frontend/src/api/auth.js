import { apiRequest } from './backendClient';

export function login(email, password) {
  return apiRequest('POST', '/auth/login', { body: { email, password } });
}
