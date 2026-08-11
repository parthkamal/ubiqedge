import { apiRequest } from './backendClient';

export function listUsers(params) {
  return apiRequest('GET', '/users', { params });
}

export function getUser(id) {
  return apiRequest('GET', `/users/${id}`);
}

export function getMe() {
  return apiRequest('GET', '/users/me');
}

export function createUser(body) {
  return apiRequest('POST', '/users', { body });
}

export function updateUser(id, body) {
  return apiRequest('PATCH', `/users/${id}`, { body });
}

export function deleteUser(id) {
  return apiRequest('DELETE', `/users/${id}`);
}
