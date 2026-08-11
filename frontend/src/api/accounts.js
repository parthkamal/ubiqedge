import { apiRequest } from './backendClient';

export function createAccount(body) {
  return apiRequest('POST', '/accounts', { body });
}

export function listAccounts(params) {
  return apiRequest('GET', '/accounts', { params });
}

export function getAccount(id) {
  return apiRequest('GET', `/accounts/${id}`);
}

export function getMyAccount() {
  return apiRequest('GET', '/accounts/me');
}

export function updateAccountStatus(id, status) {
  return apiRequest('PATCH', `/accounts/${id}/status`, { body: { status } });
}

export function getMyDevices() {
  return apiRequest('GET', '/accounts/me/devices');
}

export function listMyInvoices(params) {
  return apiRequest('GET', '/accounts/me/invoices', { params });
}
